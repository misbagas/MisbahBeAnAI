Rails.application.config.filter_parameters += [
  :password, :password_confirmation, :api_key, :authorization, :cohere_api_key
]
