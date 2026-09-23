.[] | select(.author.login == env.AUTHOR) | select(.headRefName | startswith(env.PREFIX)) | select(.headRefName != env.BRANCH) | .number
