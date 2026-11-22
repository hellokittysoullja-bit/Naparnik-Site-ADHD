# пересборка партии 12 с чистой базы: откат файлов базы к HEAD, разметка → планы → минуты → слияние → минуты базы
set -e
cd /home/user/Naparnik-Site-ADHD
T=research/27-breakdown/batch12/tools
S=/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/b12
git checkout HEAD -- lib/ai/agents/breakdown-goblin.ts lib/ai/agents/breakdown-aliases.ts lib/ai/agents/breakdown-minutes.ts research/27-breakdown/minutes/minutes.json
cp $T/dec.txt $S/dec.txt
npx tsx $T/finalize.mts
python3 $T/assemble.py
npx tsx $T/mins.mts $T
python3 $T/mfix.py $T > /dev/null
python3 $T/mexplicit.py $T | tail -1
python3 $T/merge12.py
node scripts/build-step-minutes.mjs | tail -1
