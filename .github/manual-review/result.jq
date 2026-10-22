reduce inputs as $event (null; if $event.type == "result" then $event else . end)
| if .is_error == false and (.result | type == "string" and test("\\S"))
  then .result
  else error("The agent did not return a successful, nonempty review")
  end
