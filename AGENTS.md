<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Leçons apprises

1. **Ne jamais déclarer un test en échec comme "pas mon code" sans l'avoir prouvé.** Toujours diagnostiquer la vraie cause avant de conclure. Si un test échoue, investiguer les données, l'environnement, et les effets de bord possibles.

2. **Les users de test (test-user-1/2/3) peuvent disparaître de la base test entre les runs** (cause à surveiller). Les tests doivent vérifier leur présence et les recréer si besoin, pour être idempotents.
