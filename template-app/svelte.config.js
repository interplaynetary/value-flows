import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			// Generated AT Protocol lexicon types — self-contained within the app.
			// Run `bun run pipeline` from the repo root to regenerate.
			$lex: 'src/lib/lexicons/org/openassociation',
		},
	},
};

export default config;
