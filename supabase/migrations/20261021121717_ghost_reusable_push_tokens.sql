-- Allow an Expo token to be registered again after the previous user logs out
-- on a shared device. Active ownership remains unique per environment.

alter table ghost_private.device_installations
  drop constraint if exists device_installations_app_environment_expo_token_key;

create unique index if not exists ghost_device_active_expo_token_unique
  on ghost_private.device_installations(app_environment, expo_token)
  where revoked_at is null;

