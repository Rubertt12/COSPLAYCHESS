# CosplayChess

Plataforma Fergorverse para operação de Cosplay Chess em eventos.

## Site

- Landing page anime/vitoriana
- Agenda de eventos publicada pelo painel administrativo
- Inscrição online com foto do personagem
- Galeria de eventos
- Painel administrativo com autenticação
- Exportação do elenco para o aplicativo desktop

## App desktop

O aplicativo principal e as releases ficam no repositório `Rubertt12/COSPLAYCHESS3.0`.
O painel administrativo desta landing exporta um JSON `cosplaychess-participants` contendo os participantes e as fotos incorporadas para uso offline no app.

## Backend

Supabase com tabelas e buckets isolados pelo prefixo `cosplay_` / `cosplaychess-`.
