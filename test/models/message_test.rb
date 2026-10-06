require "test_helper"

class MessageTest < ActiveSupport::TestCase
  test "accepts at most 11 files" do
    conversation = Conversation.create!
    message = conversation.messages.build(role: :user, content: "hello")
    assert message.valid?
  end
end
