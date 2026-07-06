pub struct ZetaConfig {
    pub retries: u32,
}

pub fn epsilon_run(config: &ZetaConfig) -> u32 {
    config.retries + 1
}

pub fn epsilon_main() -> u32 {
    let config = ZetaConfig { retries: 2 };
    epsilon_run(&config)
}
