package network.isc.adapters;

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.huggingface.tokenizers.Encoding;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

public class EmbeddingAdapter {
    private final OrtEnvironment env;
    private final OrtSession session;
    private final HuggingFaceTokenizer tokenizer;

    public EmbeddingAdapter(String modelPath, String tokenizerPath) throws OrtException, IOException {
        env = OrtEnvironment.getEnvironment();
        OrtSession.SessionOptions options = new OrtSession.SessionOptions();
        options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);

        session = env.createSession(modelPath, options);
        tokenizer = HuggingFaceTokenizer.newInstance(Paths.get(tokenizerPath));
    }

    public float[] embed(String text) throws OrtException {
        Encoding encoding = tokenizer.encode(text);
        long[] inputIds = encoding.getIds();
        long[] attentionMask = encoding.getAttentionMask();
        long[] tokenTypeIds = encoding.getTypeIds();

        long[][] inputIds2d = new long[][]{inputIds};
        long[][] attentionMask2d = new long[][]{attentionMask};
        long[][] tokenTypeIds2d = new long[][]{tokenTypeIds};

        Map<String, OnnxTensor> inputs = new HashMap<>();
        try {
            inputs.put("input_ids", OnnxTensor.createTensor(env, inputIds2d));
            inputs.put("attention_mask", OnnxTensor.createTensor(env, attentionMask2d));
            inputs.put("token_type_ids", OnnxTensor.createTensor(env, tokenTypeIds2d));

            try (OrtSession.Result result = session.run(inputs)) {
                float[][][] lastHiddenState = (float[][][]) result.get(0).getValue();

                float[] pooled = new float[384];
                int seqLen = lastHiddenState[0].length;
                float maskSum = 0;

                for (int i = 0; i < seqLen; i++) {
                    float mask = attentionMask[i];
                    maskSum += mask;
                    for (int j = 0; j < 384; j++) {
                        pooled[j] += lastHiddenState[0][i][j] * mask;
                    }
                }

                double norm = 0.0;
                for (int j = 0; j < 384; j++) {
                    pooled[j] /= Math.max(maskSum, 1e-9);
                    norm += pooled[j] * pooled[j];
                }

                double sqrtNorm = Math.max(Math.sqrt(norm), 1e-12);
                for (int j = 0; j < 384; j++) {
                    pooled[j] = (float) (pooled[j] / sqrtNorm);
                }

                return pooled;
            }
        } finally {
            for (OnnxTensor tensor : inputs.values()) {
                if (tensor != null) tensor.close();
            }
        }
    }

    public void close() throws OrtException {
        if (session != null) session.close();
        if (env != null) env.close();
        if (tokenizer != null) tokenizer.close();
    }
}
