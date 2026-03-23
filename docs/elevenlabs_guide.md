# WebSocket

GET /v1/text-to-speech/{voice_id}/stream-input

The Text-to-Speech WebSockets API is designed to generate audio from partial text input
while ensuring consistency throughout the generated audio. Although highly flexible,
the WebSockets API isn't a one-size-fits-all solution. It's well-suited for scenarios where:
  * The input text is being streamed or generated in chunks.
  * Word-to-audio alignment information is required.

However, it may not be the best choice when:
  * The entire input text is available upfront. Given that the generations are partial,
    some buffering is involved, which could potentially result in slightly higher latency compared
    to a standard HTTP request.
  * You want to quickly experiment or prototype. Working with WebSockets can be harder and more
    complex than using a standard HTTP API, which might slow down rapid development and testing.

Reference: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input

## AsyncAPI Specification

```yaml
asyncapi: 2.6.0
info:
  title: V 1 Text To Speech Voice Id Stream Input
  version: subpackage_v1TextToSpeechVoiceIdStreamInput.v1TextToSpeechVoiceIdStreamInput
  description: >-
    The Text-to-Speech WebSockets API is designed to generate audio from partial
    text input

    while ensuring consistency throughout the generated audio. Although highly
    flexible,

    the WebSockets API isn't a one-size-fits-all solution. It's well-suited for
    scenarios where:
      * The input text is being streamed or generated in chunks.
      * Word-to-audio alignment information is required.

    However, it may not be the best choice when:
      * The entire input text is available upfront. Given that the generations are partial,
        some buffering is involved, which could potentially result in slightly higher latency compared
        to a standard HTTP request.
      * You want to quickly experiment or prototype. Working with WebSockets can be harder and more
        complex than using a standard HTTP API, which might slow down rapid development and testing.
channels:
  /v1/text-to-speech/{voice_id}/stream-input:
    description: >-
      The Text-to-Speech WebSockets API is designed to generate audio from
      partial text input

      while ensuring consistency throughout the generated audio. Although highly
      flexible,

      the WebSockets API isn't a one-size-fits-all solution. It's well-suited
      for scenarios where:
        * The input text is being streamed or generated in chunks.
        * Word-to-audio alignment information is required.

      However, it may not be the best choice when:
        * The entire input text is available upfront. Given that the generations are partial,
          some buffering is involved, which could potentially result in slightly higher latency compared
          to a standard HTTP request.
        * You want to quickly experiment or prototype. Working with WebSockets can be harder and more
          complex than using a standard HTTP API, which might slow down rapid development and testing.
    parameters:
      voice_id:
        description: The unique identifier for the voice to use in the TTS process.
        schema:
          type: string
    bindings:
      ws:
        query:
          type: object
          properties:
            authorization:
              type: string
            single_use_token:
              type: string
            model_id:
              type: string
            language_code:
              type: string
            enable_logging:
              type: boolean
              default: true
            enable_ssml_parsing:
              type: boolean
              default: false
            output_format:
              $ref: '#/components/schemas/type_:TextToSpeechOutputFormatEnum'
            inactivity_timeout:
              type: integer
              default: 20
            sync_alignment:
              type: boolean
              default: false
            auto_mode:
              type: boolean
              default: false
            apply_text_normalization:
              $ref: >-
                #/components/schemas/type_:TextToSpeechApplyTextNormalizationEnum
            seed:
              type: integer
        headers:
          type: object
          properties:
            xi-api-key:
              type: string
    publish:
      operationId: v-1-text-to-speech-voice-id-stream-input-publish
      summary: Server message
      message:
        name: subscribe
        payload:
          $ref: >-
            #/components/schemas/type_v1TextToSpeechVoiceIdStreamInput:receiveMessage
    subscribe:
      operationId: v-1-text-to-speech-voice-id-stream-input-subscribe
      summary: Client message
      message:
        name: publish
        payload:
          $ref: >-
            #/components/schemas/type_v1TextToSpeechVoiceIdStreamInput:sendMessage
servers:
  Production:
    url: wss://api.elevenlabs.io/
    protocol: wss
    x-default: true
  Production US:
    url: wss://api.us.elevenlabs.io/
    protocol: wss
  Production EU:
    url: wss://api.eu.residency.elevenlabs.io/
    protocol: wss
  Production India:
    url: wss://api.in.residency.elevenlabs.io/
    protocol: wss
components:
  schemas:
    type_:TextToSpeechOutputFormatEnum:
      type: string
      enum:
        - mp3_22050_32
        - mp3_44100_32
        - mp3_44100_64
        - mp3_44100_96
        - mp3_44100_128
        - mp3_44100_192
        - pcm_8000
        - pcm_16000
        - pcm_22050
        - pcm_24000
        - pcm_44100
        - ulaw_8000
        - alaw_8000
        - opus_48000_32
        - opus_48000_64
        - opus_48000_96
        - opus_48000_128
        - opus_48000_192
      description: The output audio format
      title: TextToSpeechOutputFormatEnum
    type_:TextToSpeechApplyTextNormalizationEnum:
      type: string
      enum:
        - auto
        - 'on'
        - 'off'
      default: auto
      description: >-
        This parameter controls text normalization with three modes - 'auto',
        'on', and 'off'. When set to 'auto', the system will automatically
        decide whether to apply text normalization (e.g., spelling out numbers).
        With 'on', text normalization will always be applied, while with 'off',
        it will be skipped. For the 'eleven_flash_v2_5' model, text
        normalization can only be enabled with Enterprise plans. Defaults to
        'auto'.
      title: TextToSpeechApplyTextNormalizationEnum
    type_:NormalizedAlignment:
      type: object
      properties:
        charStartTimesMs:
          type: array
          items:
            type: integer
          description: >-
            A list of starting times (in milliseconds) for each character in the
            normalized text as it

            corresponds to the audio. For instance, the character 'H' starts at
            time 0 ms in the audio.

            Note these times are relative to the returned chunk from the model,
            and not the

            full audio response.
        charDurationsMs:
          type: array
          items:
            type: integer
          description: >-
            A list of durations (in milliseconds) for each character in the
            normalized text as it

            corresponds to the audio. For instance, the character 'H' lasts for
            3 ms in the audio.

            Note these times are relative to the returned chunk from the model,
            and not the

            full audio response.
        chars:
          type: array
          items:
            type: string
          description: >-
            A list of characters in the normalized text sequence. For instance,
            the first character is 'H'.

            Note that this list may contain spaces, punctuation, and other
            special characters.

            The length of this list should be the same as the lengths of
            `charStartTimesMs` and `charDurationsMs`.
      description: >-
        Alignment information for the generated audio given the input normalized
        text sequence.
      title: NormalizedAlignment
    type_:Alignment:
      type: object
      properties:
        charStartTimesMs:
          type: array
          items:
            type: integer
          description: >-
            A list of starting times (in milliseconds) for each character in the
            text as it

            corresponds to the audio. For instance, the character 'H' starts at
            time 0 ms in the audio.

            Note these times are relative to the returned chunk from the model,
            and not the

            full audio response.
        charDurationsMs:
          type: array
          items:
            type: integer
          description: >-
            A list of durations (in milliseconds) for each character in the text
            as it

            corresponds to the audio. For instance, the character 'H' lasts for
            3 ms in the audio.

            Note these times are relative to the returned chunk from the model,
            and not the

            full audio response.
        chars:
          type: array
          items:
            type: string
          description: >-
            A list of characters in the text sequence. For instance, the first
            character is 'H'.

            Note that this list may contain spaces, punctuation, and other
            special characters.

            The length of this list should be the same as the lengths of
            `charStartTimesMs` and `charDurationsMs`.
      description: >-
        Alignment information for the generated audio given the input text
        sequence.
      title: Alignment
    type_:AudioOutput:
      type: object
      properties:
        audio:
          type: string
          description: >-
            A generated partial audio chunk, encoded using the selected
            output_format, by default this

            is MP3 encoded as a base64 string.
        normalizedAlignment:
          $ref: '#/components/schemas/type_:NormalizedAlignment'
        alignment:
          $ref: '#/components/schemas/type_:Alignment'
      required:
        - audio
      title: AudioOutput
    type_:FinalOutput:
      type: object
      properties:
        isFinal:
          type: boolean
          enum:
            - true
          description: >-
            Indicates if the generation is complete. If set to `True`, `audio`
            will be null.
      title: FinalOutput
    type_v1TextToSpeechVoiceIdStreamInput:receiveMessage:
      oneOf:
        - $ref: '#/components/schemas/type_:AudioOutput'
        - $ref: '#/components/schemas/type_:FinalOutput'
      description: Receive messages from the WebSocket
      title: receiveMessage
    type_:RealtimeVoiceSettings:
      type: object
      properties:
        stability:
          type: number
          format: double
          default: 0.5
          description: Defines the stability for voice settings.
        similarity_boost:
          type: number
          format: double
          default: 0.75
          description: Defines the similarity boost for voice settings.
        style:
          type: number
          format: double
          default: 0
          description: >-
            Defines the style for voice settings. This parameter is available on
            V2+ models.
        use_speaker_boost:
          type: boolean
          default: true
          description: >-
            Defines the use speaker boost for voice settings. This parameter is
            available on V2+ models.
        speed:
          type: number
          format: double
          default: 1
          description: >-
            Controls the speed of the generated speech. Values range from 0.7 to
            1.2, with 1.0 being the default speed.
      title: RealtimeVoiceSettings
    type_:GenerationConfig:
      type: object
      properties:
        chunk_length_schedule:
          type: array
          items:
            type: number
            format: double
          description: >-
            This is an advanced setting that most users shouldn't need to use.
            It relates to our

            generation schedule.


            Our WebSocket service incorporates a buffer system designed to
            optimize the Time To First Byte (TTFB) while maintaining
            high-quality streaming.


            All text sent to the WebSocket endpoint is added to this buffer and
            only when that buffer reaches a certain size is an audio generation
            attempted. This is because our model provides higher quality audio
            when the model has longer inputs, and can deduce more context about
            how the text should be delivered.


            The buffer ensures smooth audio data delivery and is automatically
            emptied with a final audio generation either when the stream is
            closed, or upon sending a `flush` command. We have advanced settings
            for changing the chunk schedule, which can improve latency at the
            cost of quality by generating audio more frequently with smaller
            text inputs.


            The `chunk_length_schedule` determines the minimum amount of text
            that needs to be sent and present in our

            buffer before audio starts being generated. This is to maximise the
            amount of context available to

            the model to improve audio quality, whilst balancing latency of the
            returned audio chunks.


            The default value for `chunk_length_schedule` is: [120, 160, 250,
            290].


            This means that the first chunk of audio will not be generated until
            you send text that

            totals at least 120 characters long. The next chunk of audio will
            only be generated once a

            further 160 characters have been sent. The third audio chunk will be
            generated after the

            next 250 characters. Then the fourth, and beyond, will be generated
            in sets of at least 290 characters.


            Customize this array to suit your needs. If you want to generate
            audio more frequently

            to optimise latency, you can reduce the values in the array. Note
            that setting the values

            too low may result in lower quality audio. Please test and adjust as
            needed.


            Each item should be in the range 50-500.
      title: GenerationConfig
    type_:PronunciationDictionaryLocator:
      type: object
      properties:
        pronunciation_dictionary_id:
          type: string
          description: The unique identifier of the pronunciation dictionary
        version_id:
          type: string
          description: The version identifier of the pronunciation dictionary
      required:
        - pronunciation_dictionary_id
        - version_id
      description: Identifies a specific pronunciation dictionary to use
      title: PronunciationDictionaryLocator
    type_:InitializeConnection:
      type: object
      properties:
        text:
          type: string
          enum:
            - ' '
          description: The initial text that must be sent is a blank space.
        voice_settings:
          $ref: '#/components/schemas/type_:RealtimeVoiceSettings'
        generation_config:
          $ref: '#/components/schemas/type_:GenerationConfig'
        pronunciation_dictionary_locators:
          type: array
          items:
            $ref: '#/components/schemas/type_:PronunciationDictionaryLocator'
          description: >-
            Optional list of pronunciation dictionary locators. If provided,
            these dictionaries will be used to

            modify pronunciation of matching text. Must only be provided in the
            first message.


            Note: Pronunciation dictionary matches will only be respected within
            a provided chunk.
        xi-api-key:
          type: string
          description: >-
            Your ElevenLabs API key. This can only be included in the first
            message and is not needed if present in the header.
        authorization:
          type: string
          description: >-
            Your authorization bearer token. This can only be included in the
            first message and is not needed if present in the header.
      required:
        - text
      title: InitializeConnection
    type_:SendText:
      type: object
      properties:
        text:
          type: string
          description: >-
            The text to be sent to the API for audio generation. Should always
            end with a single space string.
        try_trigger_generation:
          type: boolean
          default: false
          description: >-
            This is an advanced setting that most users shouldn't need to use.
            It relates to our generation schedule.


            Use this to attempt to immediately trigger the generation of audio,
            overriding the `chunk_length_schedule`.

            Unlike flush, `try_trigger_generation` will only generate audio if
            our

            buffer contains more than a minimum

            threshold of characters, this is to ensure a higher quality response
            from our model.


            Note that overriding the chunk schedule to generate small amounts of

            text may result in lower quality audio, therefore, only use this
            parameter if you

            really need text to be processed immediately. We generally recommend
            keeping the default value of

            `false` and adjusting the `chunk_length_schedule` in the
            `generation_config` instead.
        voice_settings:
          $ref: '#/components/schemas/type_:RealtimeVoiceSettings'
          description: >-
            The voice settings field can be provided in the first
            `InitializeConnection` message and then must either be not provided
            or not changed.
        generator_config:
          $ref: '#/components/schemas/type_:GenerationConfig'
          description: >-
            The generator config field can be provided in the first
            `InitializeConnection` message and then must either be not provided
            or not changed.
        flush:
          type: boolean
          default: false
          description: >-
            Flush forces the generation of audio. Set this value to true when
            you have finished sending text, but want to keep the websocket
            connection open.


            This is useful when you want to ensure that the last chunk of audio
            is generated even when the length of text sent is smaller than the
            value set in chunk_length_schedule (e.g. 120 or 50).
      required:
        - text
      title: SendText
    type_:CloseConnection:
      type: object
      properties:
        text:
          type: string
          enum:
            - ''
          description: End the stream with an empty string
      required:
        - text
      title: CloseConnection
    type_v1TextToSpeechVoiceIdStreamInput:sendMessage:
      oneOf:
        - $ref: '#/components/schemas/type_:InitializeConnection'
        - $ref: '#/components/schemas/type_:SendText'
        - $ref: '#/components/schemas/type_:CloseConnection'
      description: Send messages to the WebSocket
      title: sendMessage

```

# Realtime

GET /v1/speech-to-text/realtime

Realtime speech-to-text transcription service. This WebSocket API enables streaming audio input and receiving transcription results.

## Event Flow
- Audio chunks are sent as `input_audio_chunk` messages
- Transcription results are streamed back in various formats (partial, committed, with timestamps)
- Supports manual commit or VAD-based automatic commit strategies

Authentication is done either by providing a valid API key in the `xi-api-key` header or by providing a valid token in the `token` query parameter. Tokens can be generated from the [single use token endpoint](/docs/api-reference/tokens/create). Use tokens if you want to transcribe audio from the client side.

Reference: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime

## AsyncAPI Specification

```yaml
asyncapi: 2.6.0
info:
  title: V 1 Speech To Text Realtime
  version: subpackage_v1SpeechToTextRealtime.v1SpeechToTextRealtime
  description: >-
    Realtime speech-to-text transcription service. This WebSocket API enables
    streaming audio input and receiving transcription results.


    ## Event Flow

    - Audio chunks are sent as `input_audio_chunk` messages

    - Transcription results are streamed back in various formats (partial,
    committed, with timestamps)

    - Supports manual commit or VAD-based automatic commit strategies


    Authentication is done either by providing a valid API key in the
    `xi-api-key` header or by providing a valid token in the `token` query
    parameter. Tokens can be generated from the [single use token
    endpoint](/docs/api-reference/tokens/create). Use tokens if you want to
    transcribe audio from the client side.
channels:
  /v1/speech-to-text/realtime:
    description: >-
      Realtime speech-to-text transcription service. This WebSocket API enables
      streaming audio input and receiving transcription results.


      ## Event Flow

      - Audio chunks are sent as `input_audio_chunk` messages

      - Transcription results are streamed back in various formats (partial,
      committed, with timestamps)

      - Supports manual commit or VAD-based automatic commit strategies


      Authentication is done either by providing a valid API key in the
      `xi-api-key` header or by providing a valid token in the `token` query
      parameter. Tokens can be generated from the [single use token
      endpoint](/docs/api-reference/tokens/create). Use tokens if you want to
      transcribe audio from the client side.
    bindings:
      ws:
        query:
          type: object
          properties:
            model_id:
              type: string
            token:
              type: string
            include_timestamps:
              type: boolean
              default: false
            include_language_detection:
              type: boolean
              default: false
            audio_format:
              $ref: '#/components/schemas/type_:AudioFormatEnum'
            language_code:
              type: string
            commit_strategy:
              $ref: >-
                #/components/schemas/type_v1SpeechToTextRealtime:TextToSpeechCommitStrategy
            vad_silence_threshold_secs:
              type: number
              format: double
              default: 1.5
            vad_threshold:
              type: number
              format: double
              default: 0.4
            min_speech_duration_ms:
              type: integer
              default: 100
            min_silence_duration_ms:
              type: integer
              default: 100
            enable_logging:
              type: boolean
              default: true
        headers:
          type: object
          properties:
            xi-api-key:
              type: string
    publish:
      operationId: v-1-speech-to-text-realtime-publish
      summary: Server message
      message:
        name: subscribe
        payload:
          $ref: >-
            #/components/schemas/type_v1SpeechToTextRealtime:receiveTranscription
    subscribe:
      operationId: v-1-speech-to-text-realtime-subscribe
      summary: Client message
      message:
        name: publish
        payload:
          $ref: '#/components/schemas/type_:InputAudioChunkPayload'
servers:
  Production:
    url: wss://api.elevenlabs.io/
    protocol: wss
    x-default: true
  Production US:
    url: wss://api.us.elevenlabs.io/
    protocol: wss
  Production EU:
    url: wss://api.eu.residency.elevenlabs.io/
    protocol: wss
  Production India:
    url: wss://api.in.residency.elevenlabs.io/
    protocol: wss
components:
  schemas:
    type_:AudioFormatEnum:
      type: string
      enum:
        - pcm_8000
        - pcm_16000
        - pcm_22050
        - pcm_24000
        - pcm_44100
        - pcm_48000
        - ulaw_8000
      default: pcm_16000
      description: Audio encoding format for speech-to-text.
      title: AudioFormatEnum
    type_v1SpeechToTextRealtime:TextToSpeechCommitStrategy:
      type: string
      enum:
        - manual
        - vad
      default: manual
      description: Strategy for committing transcriptions.
      title: TextToSpeechCommitStrategy
    type_:SessionStartedPayloadConfigCommitStrategy:
      type: string
      enum:
        - manual
        - vad
      description: Strategy for committing transcriptions.
      title: SessionStartedPayloadConfigCommitStrategy
    type_:SessionStartedPayloadConfig:
      type: object
      properties:
        sample_rate:
          type: integer
          description: Sample rate of the audio in Hz.
        audio_format:
          $ref: '#/components/schemas/type_:AudioFormatEnum'
        language_code:
          type: string
          description: Language code in ISO 639-1 or ISO 639-3 format.
        commit_strategy:
          $ref: '#/components/schemas/type_:SessionStartedPayloadConfigCommitStrategy'
          description: Strategy for committing transcriptions.
        vad_silence_threshold_secs:
          type: number
          format: double
          description: Silence threshold in seconds.
        vad_threshold:
          type: number
          format: double
          description: Threshold for voice activity detection.
        min_speech_duration_ms:
          type: integer
          description: Minimum speech duration in milliseconds.
        min_silence_duration_ms:
          type: integer
          description: Minimum silence duration in milliseconds.
        model_id:
          type: string
          description: ID of the model to use for transcription.
        enable_logging:
          type: boolean
          description: >-
            When enable_logging is set to false zero retention mode will be used
            for the request. This will mean history features are unavailable for
            this request. Zero retention mode may only be used by enterprise
            customers.
        include_timestamps:
          type: boolean
          description: >-
            Whether the session will include word-level timestamps in the
            committed transcript.
        include_language_detection:
          type: boolean
          description: >-
            Whether the session will include language detection in the committed
            transcript.
      description: Configuration for the transcription session.
      title: SessionStartedPayloadConfig
    type_:SessionStartedPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - session_started
          description: The message type identifier.
        session_id:
          type: string
          description: Unique identifier for the session.
        config:
          $ref: '#/components/schemas/type_:SessionStartedPayloadConfig'
          description: Configuration for the transcription session.
      required:
        - message_type
        - session_id
        - config
      description: Payload sent when the transcription session is successfully started.
      title: SessionStartedPayload
    type_:PartialTranscriptPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - partial_transcript
          description: The message type identifier.
        text:
          type: string
          description: Partial transcription text.
      required:
        - message_type
        - text
      description: Payload for partial transcription results that may change.
      title: PartialTranscriptPayload
    type_:CommittedTranscriptPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - committed_transcript
          description: The message type identifier.
        text:
          type: string
          description: Committed transcription text.
      required:
        - message_type
        - text
      description: Payload for committed transcription results.
      title: CommittedTranscriptPayload
    type_:TranscriptionWordType:
      type: string
      enum:
        - word
        - spacing
      description: The type of word.
      title: TranscriptionWordType
    type_:TranscriptionWord:
      type: object
      properties:
        text:
          type: string
          description: The transcribed word.
        start:
          type: number
          format: double
          description: Start time in seconds.
        end:
          type: number
          format: double
          description: End time in seconds.
        type:
          $ref: '#/components/schemas/type_:TranscriptionWordType'
          description: The type of word.
        speaker_id:
          type: string
          description: The ID of the speaker if available.
        logprob:
          type: number
          format: double
          description: Confidence score for this word.
        characters:
          type: array
          items:
            type: string
          description: The characters in the word.
      description: Word-level transcription data with timing information.
      title: TranscriptionWord
    type_:CommittedTranscriptWithTimestampsPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - committed_transcript_with_timestamps
          description: The message type identifier.
        text:
          type: string
          description: Committed transcription text.
        language_code:
          type: string
          description: Detected or specified language code.
        words:
          type: array
          items:
            $ref: '#/components/schemas/type_:TranscriptionWord'
          description: Word-level information with timestamps.
      required:
        - message_type
        - text
      description: Payload for committed transcription results with word-level timestamps.
      title: CommittedTranscriptWithTimestampsPayload
    type_:ScribeErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - error
          description: The message type identifier.
        error:
          type: string
          description: Error message describing what went wrong.
      required:
        - message_type
        - error
      description: Payload for error events during transcription.
      title: ScribeErrorPayload
    type_:ScribeAuthErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - auth_error
          description: The message type identifier.
        error:
          type: string
          description: Authentication error details.
      required:
        - message_type
        - error
      description: Payload for authentication errors.
      title: ScribeAuthErrorPayload
    type_:ScribeQuotaExceededErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - quota_exceeded
          description: The message type identifier.
        error:
          type: string
          description: Quota exceeded error details.
      required:
        - message_type
        - error
      description: Payload for quota exceeded errors.
      title: ScribeQuotaExceededErrorPayload
    type_:ScribeThrottledErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - commit_throttled
          description: The message type identifier.
        error:
          type: string
          description: Throttled error details.
      required:
        - message_type
        - error
      description: Payload for throttled errors.
      title: ScribeThrottledErrorPayload
    type_:ScribeUnacceptedTermsErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - unaccepted_terms
          description: The message type identifier.
        error:
          type: string
          description: Unaccepted terms error details.
      required:
        - message_type
        - error
      description: Payload for unaccepted terms errors.
      title: ScribeUnacceptedTermsErrorPayload
    type_:ScribeRateLimitedErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - rate_limited
          description: The message type identifier.
        error:
          type: string
          description: Rate limited error details.
      required:
        - message_type
        - error
      description: Payload for rate limited errors.
      title: ScribeRateLimitedErrorPayload
    type_:ScribeQueueOverflowErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - queue_overflow
          description: The message type identifier.
        error:
          type: string
          description: Queue overflow error details.
      required:
        - message_type
        - error
      description: Payload for queue overflow errors.
      title: ScribeQueueOverflowErrorPayload
    type_:ScribeResourceExhaustedErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - resource_exhausted
          description: The message type identifier.
        error:
          type: string
          description: Resource exhausted error details.
      required:
        - message_type
        - error
      description: Payload for resource exhausted errors.
      title: ScribeResourceExhaustedErrorPayload
    type_:ScribeSessionTimeLimitExceededErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - session_time_limit_exceeded
          description: The message type identifier.
        error:
          type: string
          description: Session time limit exceeded error details.
      required:
        - message_type
        - error
      description: Payload for session time limit exceeded errors.
      title: ScribeSessionTimeLimitExceededErrorPayload
    type_:ScribeInputErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - input_error
          description: The message type identifier.
        error:
          type: string
          description: Input error details.
      required:
        - message_type
        - error
      description: Payload for input errors.
      title: ScribeInputErrorPayload
    type_:ScribeChunkSizeExceededErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - chunk_size_exceeded
          description: The message type identifier.
        error:
          type: string
          description: Chunk size exceeded error details.
      required:
        - message_type
        - error
      description: Payload for chunk size exceeded errors.
      title: ScribeChunkSizeExceededErrorPayload
    type_:ScribeInsufficientAudioActivityErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - insufficient_audio_activity
          description: The message type identifier.
        error:
          type: string
          description: Insufficient audio activity error details.
      required:
        - message_type
        - error
      description: Payload for insufficient audio activity errors.
      title: ScribeInsufficientAudioActivityErrorPayload
    type_:ScribeTranscriberErrorPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - transcriber_error
          description: The message type identifier.
        error:
          type: string
          description: Transcriber error details.
      required:
        - message_type
        - error
      description: Payload for transcriber errors.
      title: ScribeTranscriberErrorPayload
    type_v1SpeechToTextRealtime:receiveTranscription:
      oneOf:
        - $ref: '#/components/schemas/type_:SessionStartedPayload'
        - $ref: '#/components/schemas/type_:PartialTranscriptPayload'
        - $ref: '#/components/schemas/type_:CommittedTranscriptPayload'
        - $ref: '#/components/schemas/type_:CommittedTranscriptWithTimestampsPayload'
        - $ref: '#/components/schemas/type_:ScribeErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeAuthErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeQuotaExceededErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeThrottledErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeUnacceptedTermsErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeRateLimitedErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeQueueOverflowErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeResourceExhaustedErrorPayload'
        - $ref: >-
            #/components/schemas/type_:ScribeSessionTimeLimitExceededErrorPayload
        - $ref: '#/components/schemas/type_:ScribeInputErrorPayload'
        - $ref: '#/components/schemas/type_:ScribeChunkSizeExceededErrorPayload'
        - $ref: >-
            #/components/schemas/type_:ScribeInsufficientAudioActivityErrorPayload
        - $ref: '#/components/schemas/type_:ScribeTranscriberErrorPayload'
      description: Receive transcription results from the WebSocket
      title: receiveTranscription
    type_:InputAudioChunkPayload:
      type: object
      properties:
        message_type:
          type: string
          enum:
            - input_audio_chunk
          description: The message type identifier.
        audio_base_64:
          type: string
          description: Base64-encoded audio data.
        commit:
          type: boolean
          description: Whether to commit the transcription after this chunk.
        sample_rate:
          type: integer
          description: Sample rate of the audio in Hz.
        previous_text:
          type: string
          description: >-
            Send text context to the model. Can only be sent alongside the first
            audio chunk. If sent in a subsequent chunk, an error will be
            returned.
      required:
        - message_type
        - audio_base_64
        - commit
        - sample_rate
      description: Payload for sending audio chunks from client to server.
      title: InputAudioChunkPayload

```