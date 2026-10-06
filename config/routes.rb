Rails.application.routes.draw do
  root "chat#index"

  resources :conversations, only: [:new, :show, :update, :destroy] do
    resources :messages, only: [:create], controller: "messages"
  end

  get "/resume-builder", to: "pages#resume_builder", as: :resume_builder
  get "/ai-humanizer", to: "pages#ai_humanizer", as: :ai_humanizer
  post "/ai-humanizer/humanize", to: "pages#humanize", as: :humanize_ai_humanizer
  get "/ai-checker", to: "pages#ai_checker", as: :ai_checker
  post "/ai-checker/check", to: "pages#check_ai_checker", as: :check_ai_checker
  post "/ai-checker/extract", to: "pages#extract_ai_checker_document", as: :extract_ai_checker_document
  get "/sound-to-text", to: "pages#sound_to_text", as: :sound_to_text
  get "/generate-photo", to: "pages#generate_photo", as: :generate_photo
  get "/all-service", to: "pages#all_service", as: :all_service
  get "/health", to: "health#show"
end
