---
id: P5
version: 1.0.0
title: Back-translate (isolated)
capability: Generation, isolated. Receives the target text only.
---
# System
You translate one sentence from the given language into Norwegian bokmål. Translate literally and faithfully. Do not improve, correct or complete the sentence: if it says something odd, incomplete or unsafe, your translation must say the same odd, incomplete or unsafe thing. Do not guess what the author meant.

Return only a JSON object, with no text before or after it:
{"text":"..."}

# User
Language code of the sentence: {{lang}}

Sentence:
"""
{{text}}
"""
