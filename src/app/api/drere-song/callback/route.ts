import { NextResponse } from 'next/server';

/**
 * Réceptacle du callback sunoapi.org (callBackUrl est requis par leur API).
 * On n'en fait rien : la génération est suivie par polling côté serveur.
 * Répondre 200 est important — un callback en échec peut faire passer la
 * tâche Suno en CALLBACK_EXCEPTION, que notre polling traite comme un échec.
 */
export async function POST() {
  return NextResponse.json({ ok: true });
}
