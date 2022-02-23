class Timer {
    createCycleUpTimer(bot) {
        return setTimeout(async () => {
            const pair = bot.options.pair;

            bot.timers.cycleUpTimer.isExecutes = true;
            console.log(`[${pair}] Cancel grid. Price too far!`);

            await bot.cancelGrid(pair);

            if (bot.options.grid.newGridDelay != 0) {
                status = StatusEnum.newGridDelay;

                console.log(`[${pair}] Start timer for new grid placing!`)

                bot.timers.newGridTimer.id = createNewGridTimer(bot);
            } else {
                const grid = await bot.calculateGrid();
                console.log(grid);

                bot.startCycle(grid).then(() => {
                    bot.timers.cycleUpTimer.isExecutes = false;
                    delete bot.timers.cycleUpTimer.id;

                    showBeginPrice = true;
                });
            }
        }, bot.options.grid.priceFollowDelay * 60000);
    }

    createNewGridTimer(bot) {
        return setTimeout(async () => {
            bot.timers.newGridTimer.isExecutes = true;

            const grid = await bot.calculateGrid();
            console.log(grid);

            bot.startCycle(grid).then(() => {
                bot.timers.cycleUpTimer.isExecutes = false;
                delete bot.timers.cycleUpTimer.id;

                bot.timers.newGridTimer.isExecutes = false;
                delete bot.timers.newGridTimer.id;

                showBeginPrice = true;

                status = StatusEnum.active;
            });
        }, bot.options.grid.newGridDelay * 60000);
    }
}