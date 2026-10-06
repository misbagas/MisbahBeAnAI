class HealthController < ApplicationController
  def show
    render json: {
      status: "ok",
      rails: Rails.version,
      cohere_model: ENV.fetch("COHERE_MODEL", "command-a-plus-05-2026"),
      vision_model: ENV.fetch("COHERE_VISION_MODEL", "command-a-vision-07-2025")
    }
  end
end
