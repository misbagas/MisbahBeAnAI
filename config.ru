require_relative "config/environment"
run Rails.application
Rails.application.config.hosts.clear if ENV["ALLOW_ALL_HOSTS"] == "1"
