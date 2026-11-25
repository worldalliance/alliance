# Whether a pull request, as the REST API's pulls/<n>/commits lists it, carries a commit that anyone but $ENV.BOT_EMAIL wrote, co-wrote, amended or rebased.
any(.[].commit;
  .author.email != $ENV.BOT_EMAIL
  or .committer.email != $ENV.BOT_EMAIL
  or any(.message | scan("(?im)^co-authored-by:[^\n<]*<([^>]+)>")[0]; . != $ENV.BOT_EMAIL))
