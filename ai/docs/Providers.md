# Providers

Tous les fournisseurs implémentent `AIProvider`; `ProviderSelector` ne dépend que de ce port. Les adapters disponibles sont Mock, Codex, OpenAI, Claude, Gemini et Ollama.

Le Dashboard ne reçoit que l'identifiant du provider sélectionné. Changer le provider par défaut relève exclusivement de `BridgeConfiguration`.
