# пересборка партии с чистой базы: откат файлов базы к HEAD, правка, минуты, слияние, сборка минут
set -e
# база до слияния партии 11 — коммит 913a5fb (только понимание учёбы)
cd /home/user/Naparnik-Site-ADHD
T=research/27-breakdown/batch11/tools
git checkout 913a5fb -- lib/ai/agents/breakdown-goblin.ts lib/ai/agents/breakdown-aliases.ts lib/ai/agents/breakdown-minutes.ts research/27-breakdown/minutes/minutes.json
(cd $T && python3 apply6.py . | head -3)
npx tsx $T/mins.mts $T > /dev/null
python3 $T/mfix.py $T > /dev/null
python3 $T/merge6.py $T
node scripts/build-step-minutes.mjs | tail -1
python3 research/27-breakdown/batch11/tools/add_forms.py research/27-breakdown/batch11/tools/forms-added.tsv
python3 research/27-breakdown/batch11/tools/oldfix.py
node scripts/build-step-minutes.mjs | tail -1
