require "base64"
require "csv"
require "json"
require "zip"
require "nokogiri"
require "pdf/reader"

class FileContentExtractor
  TEXT_TYPES = %w[
    text/plain text/markdown text/csv text/tab-separated-values text/html
    application/json application/xml application/javascript application/x-yaml
  ].freeze

  OFFICE_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => :docx,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => :xlsx,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" => :pptx
  }.freeze

  attr_reader :file

  def initialize(file)
    @file = file
  end

  def text?
    TEXT_TYPES.include?(file.content_type) || file.filename.to_s.match?(/\.(rb|py|js|ts|tsx|jsx|java|kt|go|rs|cpp|c|h|hpp|php|css|scss|sql|sh|yml|yaml|toml|xml|md|txt|csv|json)$/i)
  end

  def image?
    file.content_type.to_s.start_with?("image/")
  end

  def extract
    return read_plain_text if text?

    case file.content_type
    when "application/pdf"
      extract_pdf
    when *OFFICE_TYPES.keys
      send("extract_#{OFFICE_TYPES.fetch(file.content_type)}")
    else
      nil
    end
  rescue StandardError => e
    Rails.logger.warn("Could not extract #{file.filename}: #{e.class}: #{e.message}")
    nil
  end

  def data_uri
    return nil unless image?

    encoded = Base64.strict_encode64(file.download)
    "data:#{file.content_type};base64,#{encoded}"
  end

  private

  def read_plain_text
    file.download.force_encoding("UTF-8").scrub
  end

  def extract_pdf
    reader = PDF::Reader.new(StringIO.new(file.download))
    reader.pages.map(&:text).join("\n\n")
  end

  def extract_docx
    Zip::File.open_buffer(file.download) do |zip|
      entry = zip.find_entry("word/document.xml")
      return nil unless entry
      xml = Nokogiri::XML(entry.get_input_stream.read)
      xml.xpath("//*[local-name()='t']").map(&:text).join(" ")
    end
  end

  def extract_xlsx
    Zip::File.open_buffer(file.download) do |zip|
      entry = zip.find_entry("xl/sharedStrings.xml")
      return nil unless entry
      xml = Nokogiri::XML(entry.get_input_stream.read)
      xml.xpath("//*[local-name()='t']").map(&:text).join("\n")
    end
  end

  def extract_pptx
    Zip::File.open_buffer(file.download) do |zip|
      slides = zip.glob("ppt/slides/slide*.xml")
      return nil if slides.empty?
      slides.map do |slide|
        xml = Nokogiri::XML(slide.get_input_stream.read)
        xml.xpath("//*[local-name()='t']").map(&:text).join(" ")
      end.join("\n\n")
    end
  end
end
