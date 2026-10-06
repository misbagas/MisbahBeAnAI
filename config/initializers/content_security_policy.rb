Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.font_src :self, :data
    policy.img_src :self, :data, :blob, "https://images.unsplash.com"
    policy.media_src :self, :data, :blob
    policy.script_src :self, :unsafe_inline
    policy.style_src :self, :unsafe_inline
    policy.connect_src :self
  end
end
