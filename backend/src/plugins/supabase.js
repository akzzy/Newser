import { createClient } from '@supabase/supabase-js';
import fp from 'fastify-plugin';

async function supabase(fastify) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
  }

  const client = createClient(supabaseUrl, supabaseKey);
  fastify.decorate('supabase', client);
  fastify.log.info('Supabase client initialized');
}

export const supabasePlugin = fp(supabase, { name: 'supabase' });
