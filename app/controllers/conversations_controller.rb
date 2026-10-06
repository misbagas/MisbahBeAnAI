class ConversationsController < ApplicationController
  def new
    @conversations = Conversation.order(updated_at: :desc).limit(30)
    @conversation = Conversation.new(title: "New Chat")
    @initial_prompt = params[:prompt].to_s
    render "chat/index"
  end

  def show
    @conversations = Conversation.order(updated_at: :desc).limit(30)
    @conversation = Conversation.find(params[:id])
    render "chat/index"
  end

  def update
    conversation = Conversation.find(params[:id])
    title = params[:title].to_s.strip

    if title.blank?
      return render json: { error: "Chat name cannot be blank." }, status: :unprocessable_entity
    end

    if title.length > 55
      return render json: { error: "Chat name must be 55 characters or fewer." }, status: :unprocessable_entity
    end

    conversation.update!(title: title)
    render json: { id: conversation.id, title: conversation.title }
  end

  def destroy
    conversation = Conversation.find(params[:id])
    conversation.destroy!
    render json: { id: conversation.id, new_url: new_conversation_path }
  end
end
