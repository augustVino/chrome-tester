use crate::models::{DownloadError, ErrorSeverity, RetryStrategy};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct RetryAttempt {
    pub attempt_number: u32,
    pub error: DownloadError,
    pub timestamp: Instant,
    pub next_retry_at: Option<Instant>,
}

#[derive(Debug, Clone)]
pub struct TaskRetryState {
    pub task_id: String,
    pub attempts: Vec<RetryAttempt>,
    pub strategy: RetryStrategy,
    pub is_circuit_open: bool,
    pub circuit_open_until: Option<Instant>,
}

pub struct RetryManager {
    task_states: HashMap<String, TaskRetryState>,
    global_circuit_breaker: CircuitBreaker,
}

#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    failure_count: u32,
    success_count: u32,
    failure_threshold: u32,
    success_threshold: u32,
    timeout_duration: Duration,
    state: CircuitState,
    next_attempt_time: Option<Instant>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CircuitState {
    Closed,   // 正常状态，允许请求
    Open,     // 断路状态，拒绝请求
    HalfOpen, // 半开状态，允许少量请求测试
}

impl RetryManager {
    pub fn new() -> Self {
        Self {
            task_states: HashMap::new(),
            global_circuit_breaker: CircuitBreaker::new(),
        }
    }
    
    /// 记录下载失败并判断是否应该重试
    pub async fn should_retry(&mut self, task_id: &str, error_message: &str) -> Option<Duration> {
        let error = DownloadError::from_message(error_message);
        let strategy = error.retry_strategy();
        
        // 检查全局熔断器
        if self.global_circuit_breaker.is_open() {
            warn!("Global circuit breaker is open, rejecting retry for task: {}", task_id);
            return None;
        }
        
        // 获取或创建任务重试状态
        let task_state = self.task_states.entry(task_id.to_string())
            .or_insert_with(|| TaskRetryState {
                task_id: task_id.to_string(),
                attempts: Vec::new(),
                strategy: strategy.clone(),
                is_circuit_open: false,
                circuit_open_until: None,
            });
        
        // 更新策略（如果错误类型改变了）
        task_state.strategy = strategy.clone();
        
        // 检查任务级熔断器
        if task_state.is_circuit_open {
            if let Some(open_until) = task_state.circuit_open_until {
                if Instant::now() < open_until {
                    warn!("Task circuit breaker is open for task: {}, open until: {:?}", 
                          task_id, open_until);
                    return None;
                } else {
                    // 熔断器时间已过，重置状态
                    task_state.is_circuit_open = false;
                    task_state.circuit_open_until = None;
                    info!("Task circuit breaker reset for task: {}", task_id);
                }
            }
        }
        
        // 记录失败尝试
        let attempt_number = task_state.attempts.len() as u32 + 1;
        let now = Instant::now();
        
        // 计算延迟（先克隆策略以避免借用问题）
        let delay = Self::calculate_delay_static(&strategy, attempt_number);
        let next_retry_at = delay.map(|d| now + d);
        
        let attempt = RetryAttempt {
            attempt_number,
            error: error.clone(),
            timestamp: now,
            next_retry_at,
        };
        
        task_state.attempts.push(attempt);
        
        // 检查是否应该打开任务级熔断器
        Self::check_and_update_task_circuit_breaker_static(task_state);
        
        // 更新全局熔断器
        self.global_circuit_breaker.record_failure();
        
        // 根据错误严重程度和重试策略决定是否重试
        if !error.is_retryable() {
            info!("Error is not retryable for task {}: {}", task_id, error);
            return None;
        }
        
        if let Some(delay) = delay {
            info!("Will retry task {} in {:?} (attempt {})", 
                  task_id, delay, attempt_number);
            Some(delay)
        } else {
            info!("Max retry attempts reached for task {}", task_id);
            None
        }
    }
    
    /// 记录成功的下载
    pub fn record_success(&mut self, task_id: &str) {
        // 清除任务重试状态
        if let Some(task_state) = self.task_states.remove(task_id) {
            info!("Task {} completed successfully after {} attempts", 
                  task_id, task_state.attempts.len());
        }
        
        // 更新全局熔断器
        self.global_circuit_breaker.record_success();
    }
    
    /// 获取任务的重试历史
    pub fn get_retry_history(&self, task_id: &str) -> Option<&TaskRetryState> {
        self.task_states.get(task_id)
    }
    
    /// 清理过期的重试状态 (应定期调用)
    pub fn cleanup_expired_states(&mut self) {
        let now = Instant::now();
        let expired_threshold = Duration::from_secs(3600); // 1小时
        
        self.task_states.retain(|_, state| {
            if let Some(last_attempt) = state.attempts.last() {
                now.duration_since(last_attempt.timestamp) < expired_threshold
            } else {
                false
            }
        });
    }
    
    /// 获取任务的下一次重试时间
    pub fn get_next_retry_time(&self, task_id: &str) -> Option<Instant> {
        self.task_states.get(task_id)
            .and_then(|state| state.attempts.last())
            .and_then(|attempt| attempt.next_retry_at)
    }
    
    /// 强制重置任务的重试状态
    pub fn reset_task_state(&mut self, task_id: &str) {
        self.task_states.remove(task_id);
        info!("Reset retry state for task: {}", task_id);
    }
    
    /// 获取全局熔断器状态
    pub fn global_circuit_state(&self) -> &CircuitState {
        &self.global_circuit_breaker.state
    }
    
    fn calculate_delay(&self, strategy: &RetryStrategy, attempt_number: u32) -> Option<Duration> {
        Self::calculate_delay_static(strategy, attempt_number)
    }
    
    fn calculate_delay_static(strategy: &RetryStrategy, attempt_number: u32) -> Option<Duration> {
        match strategy {
            RetryStrategy::NoRetry => None,
            
            RetryStrategy::Immediate { max_attempts } => {
                if attempt_number <= *max_attempts {
                    Some(Duration::from_millis(100)) // 很短的延迟，基本上立即重试
                } else {
                    None
                }
            },
            
            RetryStrategy::ExponentialBackoff { 
                max_attempts, 
                initial_delay_ms, 
                max_delay_ms, 
                backoff_factor 
            } => {
                if attempt_number <= *max_attempts {
                    let delay_ms = (*initial_delay_ms as f64) * backoff_factor.powi(attempt_number as i32 - 1);
                    let capped_delay_ms = delay_ms.min(*max_delay_ms as f64) as u64;
                    Some(Duration::from_millis(capped_delay_ms))
                } else {
                    None
                }
            },
            
            RetryStrategy::LinearBackoff { max_attempts, delay_increment_ms } => {
                if attempt_number <= *max_attempts {
                    let delay_ms = delay_increment_ms * (attempt_number as u64);
                    Some(Duration::from_millis(delay_ms))
                } else {
                    None
                }
            },
        }
    }
    
    fn check_and_update_task_circuit_breaker_static(task_state: &mut TaskRetryState) {
        let recent_failures = task_state.attempts
            .iter()
            .rev()
            .take(5) // 检查最近5次尝试
            .filter(|attempt| {
                // 检查是否为严重错误
                matches!(attempt.error.severity(), ErrorSeverity::High | ErrorSeverity::Critical)
            })
            .count();
        
        if recent_failures >= 3 {
            task_state.is_circuit_open = true;
            task_state.circuit_open_until = Some(Instant::now() + Duration::from_secs(300)); // 5分钟
            warn!("Opening task circuit breaker for task: {} due to {} recent serious failures", 
                  task_state.task_id, recent_failures);
        }
    }
}

impl CircuitBreaker {
    pub fn new() -> Self {
        Self {
            failure_count: 0,
            success_count: 0,
            failure_threshold: 10,
            success_threshold: 5,
            timeout_duration: Duration::from_secs(60),
            state: CircuitState::Closed,
            next_attempt_time: None,
        }
    }
    
    pub fn is_open(&self) -> bool {
        match self.state {
            CircuitState::Open => {
                if let Some(next_attempt) = self.next_attempt_time {
                    Instant::now() < next_attempt
                } else {
                    true
                }
            },
            _ => false,
        }
    }
    
    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        
        match self.state {
            CircuitState::Closed => {
                if self.failure_count >= self.failure_threshold {
                    self.state = CircuitState::Open;
                    self.next_attempt_time = Some(Instant::now() + self.timeout_duration);
                    warn!("Global circuit breaker opened after {} failures", self.failure_count);
                }
            },
            CircuitState::HalfOpen => {
                self.state = CircuitState::Open;
                self.next_attempt_time = Some(Instant::now() + self.timeout_duration);
                warn!("Global circuit breaker reopened after failure in half-open state");
            },
            CircuitState::Open => {
                // 检查是否可以进入半开状态
                if let Some(next_attempt) = self.next_attempt_time {
                    if Instant::now() >= next_attempt {
                        self.state = CircuitState::HalfOpen;
                        info!("Global circuit breaker moved to half-open state");
                    }
                }
            },
        }
    }
    
    pub fn record_success(&mut self) {
        match self.state {
            CircuitState::Closed => {
                self.failure_count = 0; // 重置失败计数
                self.success_count += 1;
            },
            CircuitState::HalfOpen => {
                self.success_count += 1;
                if self.success_count >= self.success_threshold {
                    self.state = CircuitState::Closed;
                    self.failure_count = 0;
                    self.success_count = 0;
                    self.next_attempt_time = None;
                    info!("Global circuit breaker closed after {} successful attempts", self.success_threshold);
                }
            },
            CircuitState::Open => {
                // 在开启状态下不应该有成功，但如果有，则移到半开状态
                self.state = CircuitState::HalfOpen;
                self.success_count = 1;
            },
        }
    }
}

impl Default for RetryManager {
    fn default() -> Self {
        Self::new()
    }
}