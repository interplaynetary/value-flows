<script lang="ts">
  import { aip } from '$lib/aip.svelte';

  let handle = $state('');

  function submit(e: SubmitEvent) {
    e.preventDefault();
    aip.login(handle.trim());
  }
</script>

<div class="card">
  <form class="login-form" onsubmit={submit}>
    <div class="form-group">
      <label for="handle">Bluesky Handle</label>
      <input
        id="handle"
        type="text"
        bind:value={handle}
        placeholder="you.bsky.social"
        autocomplete="username"
        spellcheck="false"
        disabled={aip.loading}
        required
      />
    </div>

    {#if aip.error}
      <p class="error">{aip.error}</p>
    {/if}

    <button type="submit" class="btn" disabled={aip.loading || !handle.trim()}>
      {aip.loading ? 'Redirecting…' : 'Login with Bluesky'}
    </button>
  </form>

  <p class="signup-hint">
    Don't have a Bluesky account?
    <a href="https://bsky.app" target="_blank" rel="noopener noreferrer">Sign up</a>
  </p>
</div>

<style>
  .card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 2rem;
    max-width: 360px;
    width: 100%;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--label-color, #374151);
  }

  input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border, #d1d5db);
    border-radius: 0.5rem;
    font-size: 1rem;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  input:focus {
    outline: none;
    border-color: var(--accent, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #3b82f6) 20%, transparent);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn {
    padding: 0.625rem 1rem;
    background: var(--accent, #3b82f6);
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn:not(:disabled):hover {
    opacity: 0.85;
  }

  .error {
    font-size: 0.875rem;
    color: var(--error, #dc2626);
    margin: 0;
  }

  .signup-hint {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--muted, #6b7280);
    text-align: center;
  }

  .signup-hint a {
    color: var(--accent, #3b82f6);
    text-decoration: none;
  }

  .signup-hint a:hover {
    text-decoration: underline;
  }
</style>
