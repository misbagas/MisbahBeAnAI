require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.active_storage.service = :local
  config.action_mailer.perform_caching = false
  config.cache_store = :memory_store
  config.active_job.queue_adapter = :async
end
