class Message < ApplicationRecord
  belongs_to :conversation
  has_many_attached :files

  enum :role, { user: "user", assistant: "assistant", system: "system" }

  validates :role, presence: true
  validates :content, presence: true, unless: :files_attached?

  validate :file_count_limit
  validate :file_size_limit

  MAX_FILES = 11
  MAX_FILE_SIZE = 25.megabytes

  private

  def files_attached?
    files.attached?
  end

  def file_count_limit
    errors.add(:files, "maximum #{MAX_FILES} files per message") if files.size > MAX_FILES
  end

  def file_size_limit
    files.each do |file|
      errors.add(:files, "#{file.filename} is larger than 25 MB") if file.byte_size > MAX_FILE_SIZE
    end
  end
end
