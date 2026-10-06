class Conversation < ApplicationRecord
  has_many :messages, dependent: :destroy

  validates :title, presence: true

  def latest_user_message
    messages.where(role: "user").order(created_at: :desc).first
  end
end
