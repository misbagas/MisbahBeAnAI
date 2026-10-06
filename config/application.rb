require_relative "boot"
require "rails/all"

Bundler.require(*Rails.groups)

module CohereChatbot
  class Application < Rails::Application
    config.load_defaults 8.1
    config.autoload_lib(ignore: %w[assets tasks])
    config.eager_load_paths << Rails.root.join("app/services")
    config.time_zone = "Asia/Jakarta"

    config.generators do |g|
      g.orm :active_record, primary_key_type: :integer
      g.template_engine :erb
      g.test_framework :test_unit
    end
  end
end
