class ChatController < ApplicationController
  def index
    @conversations = Conversation.order(updated_at: :desc).limit(30)
    @conversation = @conversations.first || Conversation.new(title: "New Chat")
    @initial_prompt = params[:prompt].to_s
  end
end
