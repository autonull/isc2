package network.isc.core;

public class ReplyEvent {
    private String replyID;
    private String parentID;
    private String author;
    private String content;
    private long timestamp;
    private byte[] signature;

    public ReplyEvent() {}

    public ReplyEvent(String replyID, String parentID, String author, String content, long timestamp, byte[] signature) {
        this.replyID = replyID;
        this.parentID = parentID;
        this.author = author;
        this.content = content;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    public String getReplyID() { return replyID; }
    public void setReplyID(String replyID) { this.replyID = replyID; }

    public String getParentID() { return parentID; }
    public void setParentID(String parentID) { this.parentID = parentID; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public byte[] getSignature() { return signature; }
    public void setSignature(byte[] signature) { this.signature = signature; }
}
