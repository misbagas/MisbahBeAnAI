class ApplicationController < ActionController::Base
  rescue_from CohereClient::Error, with: :render_cohere_error

  private

  def render_cohere_error(error)
    Rails.logger.error("Cohere error: #{error.message}")
    respond_to do |format|
      format.html { redirect_back fallback_location: root_path, alert: "AI error: #{error.message}" }
      format.json { render json: { error: error.message }, status: :unprocessable_entity }
    end
  end
end
