when trying to lex build

ruzgar@ruzgar-laptop:~/Programs/protocols$ lex build --lexicons ./lexicons-expanded --out .src/lexicons
lex build

Generate TypeScript lexicon
schema files from JSON lexicon
definitions

Options:
--help Show help
[boolean]
--version Show version
number
[boolean]
--lexicons directory
containing
lexicon JSON
files
[string] [required] [default:
"./lexicons"]
--out output
directory
for
generated TS
files
[string] [required] [default:
"./src/lexicons"]
--clear clear output
directory
before
generating
files
[boolean] [default: false]
--override override
existing
files (has
no effect
with
--clear)
[boolean] [default: false]
--pretty run prettier
on generated
files
[boolean] [default: true]
--ignore-errors how to
handle
errors when
processing
input files
[boolean] [default: false]
--pure-annotati adds `/*#__P
  ons              URE__*/`
annotations
for
tree-shaking
tools. Set
this to true
if you are
using
generated
lexicons in
a library.
[boolean] [default: false]
--exclude list of
strings or
regex
patterns to
exclude
lexicon
documents by
their IDs
[array]
--include list of
strings or
regex
patterns to
include
lexicon
documents by
their IDs
[array]
--lib package name
of the
library to
import the
lex schema
utility "l"
from
[string] [default:
"@atproto/lex"]
--allowLegacyBl generate
obs schemas that
accept
legacy blob
references
(disabled by
default;
enable this
if you
encounter
issues while
processing
records
created a
long time
ago)
[boolean] [default: false]
--importExt file
extension to
use for
import
statements
in generated
files (e.g.
".ts",
".mts",
".cts"). Use
--import-ext
"" to
generate ext
ension-less
imports.
[string] [default: ".js"]
--fileExt file
extension to
use for
generated
files (e.g.
".ts",
".mts",
".cts")
[string] [default: ".ts"]
--indexFile generate an
"index.<file
                   Ext>" file
that exports
all
root-level
namespaces
[boolean] [default: false]
--ignoreInvalid skip over
Lexicons invalid
lexicon
files
instead of
exiting with
an error
[boolean] [default: false]

Error: Error parsing lexicon document lexicons-expanded/openassociation/agent.json
at readLexicons (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-builder/dist/lexicon-directory-indexer.js:33:27)
at async [Symbol.asyncIterator] (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-document/dist/lexicon-iterable-indexer.js:87:37)
at async [Symbol.asyncIterator] (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-builder/dist/filtered-indexer.js:24:26)
at async LexBuilder.load (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-builder/dist/lex-builder.js:55:30)
at async build (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-builder/dist/index.js:36:5)
at async Object.handler (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex/bin/lex:112:7) {
[cause]: ValidationError: Expected one of "boolean", "integer", "string", "bytes", "cid-link", "blob", "unknown", "ref", "union" or "array" at $.defs.main.record.properties.primaryLocation.type (got "object")
at ValidationContext.issue (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:192:29)
at ValidationContext.issueInvalidPropertyValue (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:274:21)
at DiscriminatedUnionSchema.validateInContext (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/schema/discriminated-union.js:57:20)
at ValidationContext.validate (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:96:34)
at ValidationContext.validateChild (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:146:25)
at DictSchema.validateInContext (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/schema/dict.js:52:37)
at ValidationContext.validate (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:96:34)
at ValidationContext.validateChild (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:146:25)
at ObjectSchema.validateInContext (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/schema/object.js:42:32)
at ValidationContext.validate (/home/ruzgar/.bun/install/global/node_modules/@atproto/lex-schema/dist/core/validator.js:96:34) {
error: 'InvalidRequest',
issues: [ [IssueInvalidValue] ]
}
}
