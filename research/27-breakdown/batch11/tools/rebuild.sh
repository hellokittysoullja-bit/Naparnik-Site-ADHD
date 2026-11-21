# пересборка партии с чистой базы: откат файлов базы к HEAD, правка, минуты, слияние, сборка минут
set -e
cd /home/user/Naparnik-Site-ADHD
T=research/27-breakdown/batch11/tools
git checkout HEAD -- lib/ai/agents/breakdown-goblin.ts lib/ai/agents/breakdown-aliases.ts lib/ai/agents/breakdown-minutes.ts research/27-breakdown/minutes/minutes.json
(cd $T && python3 apply6.py . | head -3)
npx tsx $T/mins.mts $T > /dev/null
python3 $T/mfix.py $T > /dev/null
python3 $T/merge6.py $T
node scripts/build-step-minutes.mjs | tail -1
