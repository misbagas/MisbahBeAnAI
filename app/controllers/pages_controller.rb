class PagesController < ApplicationController
  HUMANIZER_TONES = %w[Conversational Professional Academic Friendly Concise Persuasive].freeze
  HUMANIZER_LANGUAGES = ["English (US)", "English (UK)", "Indonesian", "Spanish", "French", "German"].freeze
  HUMANIZER_INTENSITIES = %w[light balanced creative].freeze
  HUMANIZER_MAX_WORDS = 5_000
  HUMANIZER_MAX_CHARS = 50_000
  AI_CHECKER_MAX_WORDS = 10_000
  AI_CHECKER_MAX_CHARS = 120_000
  AI_CHECKER_MAX_UPLOAD_SIZE = 25.megabytes
  AI_CHECKER_UPLOAD_TYPES = {
    ".txt" => "text/plain",
    ".md" => "text/markdown",
    ".csv" => "text/csv",
    ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf" => "application/pdf"
  }.freeze

  ExtractedCheckerUpload = Struct.new(:filename, :content_type, :contents) do
    def download
      contents
    end
  end

  def resume_builder
  end

  def ai_humanizer
  end

  def ai_checker
  end

  def sound_to_text
  end

  def generate_photo
  end

  def check_ai_checker
    text = params[:text].is_a?(String) ? params[:text].strip : ""
    error = ai_checker_text_error(text)
    return render json: { error: error }, status: :unprocessable_entity if error

    sentence_count = text.gsub(/\s+/, " ").split(/(?<=[.!?])\s+/).reject(&:blank?).length
    result = CohereClient.new.analyze_writing(text: text, sentence_count: sentence_count)
    render json: result.merge(word_count: text.scan(/\S+/).length, sentence_count: sentence_count)
  end

  def extract_ai_checker_document
    upload = params[:file]
    unless upload.is_a?(ActionDispatch::Http::UploadedFile)
      return render json: { error: "Choose a document to upload." }, status: :unprocessable_entity
    end
    if upload.size > AI_CHECKER_MAX_UPLOAD_SIZE
      return render json: { error: "Documents must be 25 MB or smaller." }, status: :unprocessable_entity
    end

    extension = File.extname(upload.original_filename.to_s).downcase
    content_type = AI_CHECKER_UPLOAD_TYPES[extension]
    unless content_type
      return render json: { error: "Upload a TXT, MD, CSV, DOCX, or PDF document." }, status: :unprocessable_entity
    end

    upload.tempfile.rewind
    bytes = upload.tempfile.read
    upload.tempfile.rewind
    file = ExtractedCheckerUpload.new(upload.original_filename, content_type, bytes)
    text = FileContentExtractor.new(file).extract.to_s.strip
    return render json: { error: "No readable text was found in that document." }, status: :unprocessable_entity if text.blank?

    error = ai_checker_text_error(text)
    return render json: { error: error }, status: :unprocessable_entity if error

    render json: { text: text, filename: upload.original_filename, word_count: text.scan(/\S+/).length }
  end

  def humanize
    text = params[:text].is_a?(String) ? params[:text].strip : ""
    return render json: { error: "Add some text first." }, status: :unprocessable_entity if text.blank?

    if text.length > HUMANIZER_MAX_CHARS
      return render json: { error: "Text must be 50,000 characters or fewer." }, status: :unprocessable_entity
    end

    word_count = text.scan(/\S+/).length
    if word_count > HUMANIZER_MAX_WORDS
      return render json: { error: "Text must be #{HUMANIZER_MAX_WORDS} words or fewer." }, status: :unprocessable_entity
    end

    result = CohereClient.new.humanize(
      text: text,
      tone: HUMANIZER_TONES.include?(params[:tone]) ? params[:tone] : HUMANIZER_TONES.first,
      language: HUMANIZER_LANGUAGES.include?(params[:language]) ? params[:language] : HUMANIZER_LANGUAGES.first,
      intensity: HUMANIZER_INTENSITIES.include?(params[:intensity]) ? params[:intensity] : "balanced",
      preserve_meaning: params[:preserve_meaning].nil? || ActiveModel::Type::Boolean.new.cast(params[:preserve_meaning])
    )

    render json: { text: result[:text], model: result[:model] }
  end

  def all_service
    @services = [
      {
        slug: "resume-builder",
        category: "POPULAR",
        number: "01",
        icon: "CV",
        tone: "violet",
        title: "Resume Builder",
        description: "Create a professional, ATS-friendly resume with clean layouts and smart content suggestions.",
        action: "Build Resume",
        connected: true,
        prompt: "Help me build a professional, ATS-friendly resume. Ask me for the information you need, then organize it into a polished resume."
      },
      {
        slug: "ai-humanizer",
        category: "WRITING",
        number: "02",
        icon: "HU",
        tone: "blue",
        title: "AI Humanizer",
        description: "Rewrite AI-generated text to feel more natural, readable, and human while keeping the meaning.",
        action: "Humanize Text",
        connected: true,
        prompt: "Rewrite the text I provide so it sounds natural and clear while preserving its meaning. Ask me to paste the text."
      },
      {
        slug: "ai-checker",
        category: "DETECTION",
        number: "03",
        icon: "AI",
        tone: "green",
        title: "AI Checker",
        description: "Analyze text and get a quick AI-content assessment with a clear, easy-to-understand result.",
        action: "Check Content",
        connected: true,
        prompt: "Review text I provide for signs that it may be AI-generated. Explain the evidence and uncertainty, and do not present the result as definitive. Ask me to paste the text."
      },
      {
        slug: "sound-to-text",
        category: "AUDIO",
        number: "04",
        icon: "ST",
        tone: "orange",
        title: "Sound to Text",
        description: "Turn meetings, lectures, podcasts, and voice recordings into searchable text in seconds.",
        action: "Transcribe Audio",
        connected: false,
        prompt: "I want to transcribe an audio recording. Help me with the transcript."
      },
      {
        slug: "generate-photo",
        category: "IMAGE",
        number: "05",
        icon: "GP",
        tone: "pink",
        title: "Generate Photo",
        description: "Transform your ideas into high-quality AI images for content, concepts, marketing, and more.",
        action: "Generate Photo",
        connected: false,
        prompt: "Help me create a detailed prompt for an AI-generated image. Ask what I want the image to show."
      },
      {
        slug: "generate-video",
        category: "VIDEO",
        number: "06",
        icon: "GV",
        tone: "violet",
        title: "Generate Video",
        description: "Create engaging videos from prompts and concepts for social media, presentations, and campaigns.",
        action: "Generate Video",
        connected: false,
        prompt: "Help me plan an AI-generated video. Ask for the concept, style, duration, and audience, then prepare a detailed video-generation prompt."
      },
      {
        slug: "photo-to-video",
        category: "VIDEO",
        number: "07",
        icon: "PV",
        tone: "cyan",
        title: "Photo to Video",
        description: "Bring still images to life with AI motion, transitions, and cinematic video generation.",
        action: "Animate Photo",
        connected: false,
        prompt: "Help me plan how to animate a still photo into a short video. Ask me to describe the image and the motion I want."
      }
    ]
  end

  private

  def ai_checker_text_error(text)
    return "Enter some text before checking." if text.blank?
    return "Text must be 120,000 characters or fewer." if text.length > AI_CHECKER_MAX_CHARS
    return "Text must be 10,000 words or fewer." if text.scan(/\S+/).length > AI_CHECKER_MAX_WORDS

    nil
  end
end
