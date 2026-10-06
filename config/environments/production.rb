require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.active_storage.service = ENV.fetch("ACTIVE_STORAGE_SERVICE", "local").to_sym
  config.force_ssl = ENV["FORCE_SSL"] == "1"
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")
end
