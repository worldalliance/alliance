# Understanding [SC 3.3.7](https://w3.org/TR/WCAG22#redundant-entry) Redundant Entry (Level A)

Source: <https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html>

Retrieved: 2026-11-06

Copyright © 2026 World Wide Web Consortium. W3C® liability, trademark and permissive license rules apply (https://www.w3.org/copyright/software-license/); WAI's permission page puts WAI material under the W3C Document License (https://www.w3.org/Consortium/Legal/copyright-documents). Copied verbatim: the page's main content, converted from HTML to Markdown, with the site's navigation, header and footer left out. Page date: Updated 17 September 2025.

---

## In Brief

Goal

Make it easier for users to complete multi-step processes.

What to do

Don't ask for the same information twice in the same activity.

Why it's important

Some people with cognitive disabilities have difficulty remembering what they entered before.

## Success Criterion (SC)

Information previously entered by or provided to the user that is required to be entered again in the same [process](#dfn-process) is either:

- auto-populated, or
- available for the user to select.

Except when:

- re-entering the information is [essential](#dfn-essential),
- the information is required to ensure the security of the content, or
- previously entered information is no longer valid.

## Intent

The intent of this success criterion is to ensure that users can successfully complete multi-step processes. It reduces cognitive effort where information is asked for more than once during a process. It also reduces the need to recall information provided in a previous step.

Information that is required to be remembered for input can pose a significant barrier to users with cognitive or memory difficulties. All users experience a natural gradual mental fatigue as they proceed through steps in a process. This fatigue is accelerated by the stress of recalling information from short-term working memory. Users with learning, and cognitive disabilities are highly susceptible to mental fatigue.

Requiring people to recall information previously entered can cause them to give up or re-enter the same information incorrectly. The autocomplete feature of browsers is not considered sufficient because it is the content (the website) that needs to provide the stored information for a redundant entry, or avoid asking for the same information again.

This success criterion does not add a requirement to store information between sessions. A [process](#dfn-process) is defined on the basis of an activity and is not applicable when a user returns after closing a session or navigating away. However, a process can run across different domains, so if a check-out process includes a 3rd party payment provider, that would be in scope.

The term "available to select" is not prescriptive. The term allows authors to develop techniques where auto-population is not possible. It can include allowing the user to:

- select and populate a field, including from a drop-down;
- select text from the page and copy it into an input;
- tick a checkbox to populate inputs with the same values as previously entered (e.g., my billing address is the same as my shipping address).

Data which is "available to select" would need to be on the same page. Ideally, it would be visible by default and closely associated with the input where the data is required. However, it could be elsewhere on a page, including within a show/hide component.

This success criterion does not apply if data is provided by the user with a different method, such as uploading a resume in a document format.

This success criterion does not impact [Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html), for which allowing auto-filling of passwords is a sufficient technique. In that case the filling is performed by the user's browser. Redundant Entry is asking for the website content to make the previous entry available, but not between sessions or for essential purposes such as asking for a password.

This criterion does not include requirements or exceptions specific to privacy or personally identifiable information (PII), but when implementing techniques such as auto-population, authors should ensure data protection when storing information even temporarily during a process. It is possible to eliminate redundant entry in ways that do not introduce additional privacy risks, but it is also possible that a poor implementation (for meeting this criterion) could leak additional PII.

### Exceptions

There are exceptions for:

- Essential uses of input re-entry for things like memory games which would be invalidated if the previous answers were supplied.
- Security measures such as preventing a password string from being shown or copied. When creating a password, it should be a unique and complex string and therefore cannot be validated by the author. If the system requires the user to manually create a password that is not displayed, having users re-validate their new string is allowed as an exception.
- When the previously entered information is no longer valid, it can be requested that the user enter that information again.

## Benefits

- Users with cognitive disabilities experience short-term, working memory difficulty. Not having to repeatedly remember particular information reduces stress and the likelihood of mistakes.
- Users who experience difficulty forming new memories, recalling information, and other functions related to cognition can complete processes without having to unnecessarily rely on their memory.
- Users with mobility impairments, for example using switch control or voice input, benefit from a reduced need for text entry.

## Examples

- A form requests the user’s corporate identification number (ID) in the first step of a process to purchase a new computer. In the 3rd step the user is asked to confirm that the computer will belong to the user (rather than a colleague), and re-shows the ID. It allows the user to change the ID, but defaults to the previously entered one.
- A form on an e-commerce website allows the user to confirm that the billing address and delivery address are the same address.
- A user submits a checkout form with an incorrect credit card number in it. The page updates, showing an error message. Submitted information, such as credit card number, is not cleared from the form.
- A search results page pre-fills the search input with the previously entered search term in the same process.

## Related Resources

Resources are for information purposes only, no endorsement implied.

- [Cognitive Accessibility Gap Analysis Topic 3: Entering Data, Error Prevention, & Recovery](https://www.w3.org/TR/coga-gap-analysis/#table3)
- [Making Content Usable for People with Cognitive and Learning Disabilities 4.5.4 Design Forms to Prevent Mistakes](https://www.w3.org/TR/coga-usable/#design-forms-to-prevent-mistakes-pattern)

## Techniques

Each item in this section represents a technique or combination of techniques that the Accessibility Guidelines Working Group deems sufficient for meeting this success criterion. A technique may go beyond the minimum requirement of the criterion. There may be other ways of meeting the criterion not covered by these techniques. For information on using other techniques, see [Understanding Techniques for WCAG Success Criteria](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), particularly the "Other Techniques" section.

### Sufficient Techniques

- [G221: Provide data from a previous step in a process](https://www.w3.org/WAI/WCAG22/Techniques/general/G221)
- Not requesting the same information twice (Potential future technique)

## Key Terms

essential

if removed, would fundamentally change the information or functionality of the content, **and** information and functionality cannot be achieved in another way that would conform

process

series of user actions where each action is required in order to complete an activity

Example 1

Successful use of a series of web pages on a shopping site requires users to view alternative products, prices and offers, select products, submit an order, provide shipping information and provide payment information.

Example 2

An account registration page requires successful completion of a [Turing test](https://www.w3.org/TR/turingtest/) before the registration form can be accessed.

**Errata:**

- Changing the example provided to avoid potential confusion

[View all errata](https://www.w3.org/WAI/WCAG22/errata/)

[Back to Top](#top)
