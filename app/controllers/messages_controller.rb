class MessagesController < ApplicationController
  def create
    files = Array(params[:files]).reject(&:blank?)
    text = params[:content].to_s.strip

    if text.blank? && files.empty?
      return render json: { error: "Enter a message or attach a file." }, status: :unprocessable_entity
    end

    if files.length > Message::MAX_FILES
      return render json: { error: "You can upload up to #{Message::MAX_FILES} files per message." }, status: :unprocessable_entity
    end

    oversized = files.find { |file| file.size > Message::MAX_FILE_SIZE }
    if oversized
      return render json: { error: "#{oversized.original_filename} is larger than 25 MB." }, status: :unprocessable_entity
    end

    @conversation = if params[:conversation_id] == "new"
      Conversation.create!(title: "New Chat")
    else
      Conversation.find(params[:conversation_id])
    end

    user_message = @conversation.messages.create!(role: :user, content: text.presence || "Uploaded #{files.length} file#{'s' unless files.length == 1}.")
    user_message.files.attach(files)

    result = CohereClient.new.generate(
      conversation: @conversation,
      user_message: user_message
    )

    assistant = @conversation.messages.create!(
      role: :assistant,
      content: result[:text].presence || "I couldn't generate a response.",
      metadata: { citations: result[:citations], model: result[:model] }
    )

    @conversation.update!(title: title_from(text)) if @conversation.title == "New Chat" && text.present?

    render json: {
      conversation: {
        id: @conversation.id,
        title: @conversation.title,
        url: conversation_path(@conversation),
        message_count: @conversation.messages.count
      },
      user_message: message_json(user_message),
      assistant_message: message_json(assistant)
    }, status: :created
  end

  private

  def title_from(text)
    text.truncate(55, omission: "…")
  end

  def message_json(message)
    {
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.created_at.iso8601,
      files: message.files.map do |file|
        {
          name: file.filename.to_s,
          content_type: file.content_type,
          byte_size: file.byte_size,
          url: rails_blob_path(file, disposition: "inline")
        }
      end,
      citations: message.metadata.is_a?(Hash) ? message.metadata["citations"] : nil
    }
  end
end
