# ISC Java Client

This directory contains a complete Java implementation of the Internet Semantic Chat (ISC) protocol, designed for desktop users via a native Swing UI. It mirrors the TypeScript implementation's essential functionality and demonstrates semantic interoperability across languages.

## Features

*   **100% Local Embeddings:** Uses [ONNX Runtime](https://onnxruntime.ai/) and DJL HuggingFace Tokenizers to run `all-MiniLM-L6-v2` locally on the JVM.
*   **Auto-Downloading Models:** On first launch, the required ONNX and tokenizer JSON files are automatically downloaded from HuggingFace to your `~/.isc-java/models/` directory.
*   **Decentralized Networking:** Uses `jvm-libp2p` for node identity (Ed25519), TCP/WebSocket transport, Noise encryption, and Yamux/Mplex multiplexing.
*   **ISC Protocols:** Implements the custom stream handlers for `/isc/chat/1.0`, `/isc/announce/1.0`, and `/isc/query/1.0`.
*   **Cryptographic Safety:** Every outgoing `SignedAnnouncement` and `ChatMessage` is securely signed by your `jvm-libp2p` Private Key and transmitted as CBOR.
*   **Semantic Matching:** Accurate Locality-Sensitive Hashing (LSH) logic identical to the TypeScript `PROTOCOL.md` specification.
*   **Desktop UI:** A lightweight, IRC-inspired interface to browse local channels, broadcast thoughts, and view discovered peers.

## Requirements

*   Java Development Kit (JDK) 17 or higher
*   Maven 3.6+
*   Internet access for the initial ~22MB model download and connecting to bootstrap peers

## Building & Running

To build the executable application `jar` using Maven:

```bash
cd java
mvn clean package
```

To run the application:

```bash
mvn exec:java -Dexec.mainClass="network.isc.ISCApplication"
```

## How It Works

1.  **Identity:** On launch, a new Ed25519 `PrivKey` is generated using libp2p.
2.  **Channel Creation:** When you define a channel and "thoughts", the app embeds the text into a 384-dimensional vector locally.
3.  **Broadcasting:** The vector is hashed using LSH. A `SignedAnnouncement` is constructed and pushed over the P2P network using the `/isc/announce/1.0` stream protocol.
4.  **Connecting:** You can manually dial any `Multiaddr` of another peer. The client will open three simultaneous streams (Announce, Query, Chat). Messages broadcast locally in your active channel are then securely passed to all active dial streams.
