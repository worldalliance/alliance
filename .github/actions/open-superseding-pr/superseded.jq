.[] | select(.author.login == env.AUTHOR) | select([.headRefName | startswith(env.PREFIXES | split(" ")[])] | any) | select(.headRefName != env.BRANCH) | .number
