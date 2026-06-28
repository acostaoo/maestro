import { CalcService } from "./calc.service";

const calcService = new CalcService();
describe("CalcService", () => {
    //Effectiveness multiplier tests
    describe("calculate", () => {
        it("returns a valid result for a regular physical attack", () => {
            const result = calcService.calculate({
                attacker: { name: 'Garchomp' },
                defender: { name: 'Basculegion' },
                move: { name: 'Earthquake' }
            });
            expect(result.minDamage).toBeGreaterThan(0);
            expect(result.maxDamage).toBeGreaterThan(0);
            expect(result.defenderMaxHP).toBeGreaterThan(0);
            expect(result.koChanceText).toBeTruthy();
        });

        it('returns a multiplier of 2 for a very effective move', () => {
            const result = calcService.calculate({
                attacker: { name: 'Garchomp' },
                defender: { name: 'Tyranitar' },
                move: { name: 'Earthquake' }
            });
            expect(result.effectiveness).toBe(2);
        });

        it('returns a multiplier of 4 for a super effective move', () => {
            const result = calcService.calculate({
                attacker: { name: 'Kingambit' },
                defender: { name: 'Tyranitar' },
                move: { name: 'Low kick' }
            });
            expect(result.effectiveness).toBe(4);
        });

        it('returns a multiplier of 0.5 for a not very effective attack', () => {
            const result = calcService.calculate({
                attacker: { name: 'Whimsicott' },
                defender: { name: 'Charizard-Mega-Y' },
                move: { name: 'Moonblast' }
            });
            expect(result.effectiveness).toBe(0.5);
        });

        it('returns a multiplier of 0.25 for a not effective at all move', () => {
            const result = calcService.calculate({
                attacker: { name: 'Sinistcha' },
                defender: { name: 'Sceptile-Mega' },
                move: { name: 'Matcha Gotcha' }
            });
            expect(result.effectiveness).toBe(0.25);
        });

        it('returns a multiplier of 0 for an immune move', () => {
            const result = calcService.calculate({
                attacker: { name: 'Garchomp' },
                defender: { name: 'Charizard' },
                move: { name: 'Earthquake' }
            });
            expect(result.effectiveness).toBe(0);
        });

        //Items
        it('returns more damage when the attacker holds Life Orb', () => {
            const resultWithoutItem = calcService.calculate({
                attacker: { name: 'Garchomp',item:'Sitrus Berry' },
                defender: { name: 'Basculegion' },
                move: { name: 'Earthquake' }
            });
            const resultWithItem = calcService.calculate({
                attacker: { name: 'Garchomp', item: 'Life Orb' },
                defender: { name: 'Basculegion' },
                move: { name: 'Earthquake' }
            });
            expect(resultWithItem.maxDamage).toBeGreaterThan(resultWithoutItem.maxDamage);
        });

        it('returns half damage when the defenders holds a type matched berry', () => {
            const resultWithMismatchedBerry = calcService.calculate({
                attacker: { name: 'Basculegion' },
                defender: { name: 'Sinistcha', item: 'Occa Berry' },
                move: { name: 'Last Respects' }
            });
            const resultWithMatchedBerry = calcService.calculate({
                attacker: { name: 'Basculegion' },
                defender: { name: 'Sinistcha', item: 'Kasib Berry' },
                move: { name: 'Last Respects' }
            });
            expect(resultWithMatchedBerry.maxDamage).toBeLessThan(resultWithMismatchedBerry.maxDamage);
        });

        it('returns more damage when the attacker holds a type boosting item', () => {
            const resultWithNonBoostingItem = calcService.calculate({
                attacker: { name: 'Torkoal', item: 'Heat Rock' },
                defender: { name: 'Basculegion' },
                move: { name: 'Eruption' }
            });

            const resultWithBoostingItem = calcService.calculate({
                attacker: { name: 'Torkoal', item: 'Charcoal' },
                defender: { name: 'Basculegion' },
                move: { name: 'Eruption' }
            });

            expect(resultWithBoostingItem.maxDamage).toBeGreaterThan(resultWithNonBoostingItem.maxDamage);
            expect(resultWithBoostingItem.minDamage).toBeGreaterThan(resultWithNonBoostingItem.minDamage);
        });

            //i may be missing items that are legal in teh regulation that impact dmg

        //Weather conditions

        it('returns more damage when the weather is sunny and the move is fire type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Charizard-Mega-Y' },
                defender: { name: 'Basculegion' },
                move: { name: 'Heat Wave' },
                field: { weather: 'None' } 
            });

            const resultWithSunnyWeather = calcService.calculate({
                attacker: { name: 'Charizard-Mega-Y' },
                defender: { name: 'Basculegion' },
                move: { name: 'Heat Wave' },
                field: { weather: 'Sunny' }
            });
            expect(resultWithSunnyWeather.maxDamage).toBeGreaterThan(resultWithoutWeather.maxDamage);
            expect(resultWithSunnyWeather.minDamage).toBeGreaterThan(resultWithoutWeather.minDamage);
        });

        it('returns less damage when the weather is rainy and the move is fire type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Charizard-Mega-Y' },
                defender: { name: 'Basculegion' },
                move: { name: 'Heat Wave' },
                field: { weather: 'None' } 
            });

            const resultWithRainyWeather = calcService.calculate({
                attacker: { name: 'Charizard-Mega-Y' },
                defender: { name: 'Basculegion' },
                move: { name: 'Heat Wave' },
                field: { weather: 'Rainy' }
            });
            expect(resultWithRainyWeather.maxDamage).toBeLessThan(resultWithoutWeather.maxDamage);
            expect(resultWithRainyWeather.minDamage).toBeLessThan(resultWithoutWeather.minDamage);
        });

        it('returns more damage when the weather is rainy and the move is water type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Swampert-Mega' },
                defender: { name: 'Grimmsnarl' },
                move: { name: 'Wave Crash' },
                field: { weather: 'None' } 
            });

            const resultWithRainyWeather = calcService.calculate({
                attacker: { name: 'Swampert-Mega' },
                defender: { name: 'Grimmsnarl' },
                move: { name: 'Wave Crash' },
                field: { weather: 'Rainy' }
            });
            expect(resultWithRainyWeather.maxDamage).toBeGreaterThan(resultWithoutWeather.maxDamage);
            expect(resultWithRainyWeather.minDamage).toBeGreaterThan(resultWithoutWeather.minDamage);
        });

        it('returns less damage when the weather is sunny and the move is water type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Swampert-Mega' },
                defender: { name: 'Grimmsnarl' },
                move: { name: 'Wave Crash' },
                field: { weather: 'None' } 
            });

            const resultWithSunnyWeather = calcService.calculate({
                attacker: { name: 'Swampert-Mega' },
                defender: { name: 'Grimmsnarl' },
                move: { name: 'Wave Crash' },
                field: { weather: 'Sunny' }
            });
            expect(resultWithSunnyWeather.maxDamage).toBeLessThan(resultWithoutWeather.maxDamage);
            expect(resultWithSunnyWeather.minDamage).toBeLessThan(resultWithoutWeather.minDamage);
        });

        it('returns the same damage when the weather is sunny and the move is flying type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Pelipper' },
                defender: { name: 'Staraptor' },
                move: { name: 'Hurricane' },
                field: { weather: 'None' } 
            });

            const resultWithRainyWeather = calcService.calculate({
                attacker: { name: 'Pelipper' },
                defender: { name: 'Staraptor' },
                move: { name: 'Hurricane' },
                field: { weather: 'Rainy' }
            });
            expect(resultWithRainyWeather.maxDamage).toBeCloseTo(resultWithoutWeather.maxDamage);
            expect(resultWithRainyWeather.minDamage).toBeCloseTo(resultWithoutWeather.minDamage);
        });

        it('returns more damage when weather is sandstorm and the move is rock type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Aerodactyl' },
                defender: { name: 'Garchomp' },
                move: { name: 'Rock Slide' },
                field: { weather: 'None' } 
            });

            const resultWithSandstormWeather = calcService.calculate({
                attacker: { name: 'Aerodactyl' },
                defender: { name: 'Garchomp' },
                move: { name: 'Rock Slide' },
                field: { weather: 'Sandstorm' }
            });
            expect(resultWithSandstormWeather.maxDamage).toBeGreaterThan(resultWithoutWeather.maxDamage);
            expect(resultWithSandstormWeather.minDamage).toBeGreaterThan(resultWithoutWeather.minDamage);
        });

        it('returns less damage when weather is sandstorm, the defender is rock type and its a special move', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Rotom-Wash' },
                defender: { name: 'Tyranitar' },
                move: { name: 'Thunderbolt' },
                field: { weather: 'None' } 
            });

            const resultWithSandstormWeather = calcService.calculate({
                attacker: { name: 'Rotom-Wash' },
                defender: { name: 'Tyranitar' },
                move: { name: 'Thunderbolt' },
                field: { weather: 'Sandstorm' }
            });
            expect(resultWithSandstormWeather.maxDamage).toBeLessThan(resultWithoutWeather.maxDamage);
            expect(resultWithSandstormWeather.minDamage).toBeLessThan(resultWithoutWeather.minDamage);
        });

        it('returns more damage when weather is SNOW and the move is ice type', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Ninetales-Alola' },
                defender: { name: 'Garchomp' },
                move: { name: 'Blizzard' },
                field: { weather: 'None' } 
            });

            const resultWithSnowWeather = calcService.calculate({
                attacker: { name: 'Ninetales-Alola' },
                defender: { name: 'Garchomp' },
                move: { name: 'Blizzard' },
                field: { weather: 'Snow' }
            });
            expect(resultWithSnowWeather.maxDamage).toBeGreaterThan(resultWithoutWeather.maxDamage);
            expect(resultWithSnowWeather.minDamage).toBeGreaterThan(resultWithoutWeather.minDamage);
        });

        it('returns less damage when weather is snow, the defender is ice type and its a physical move', () => {
            const resultWithoutWeather = calcService.calculate({
                attacker: { name: 'Mamoswine' },
                defender: { name: 'Weavile' },
                move: { name: 'Icicle Crash' },
                field: { weather: 'None' } 
            });

            const resultWithSnowWeather = calcService.calculate({
                attacker: { name: 'Mamoswine' },
                defender: { name: 'Weavile' },
                move: { name: 'Icicle Crash' },
                field: { weather: 'Snow' }
            });
            expect(resultWithSnowWeather.maxDamage).toBeLessThan(resultWithoutWeather.maxDamage);
            expect(resultWithSnowWeather.minDamage).toBeLessThan(resultWithoutWeather.minDamage);
        });

        // Abilities
        //more tests are needed

        it('returns 0 damage when the defender has Levitate and the move is Ground type', () => {
            const result = calcService.calculate({
                attacker: { name: 'Garchomp' },
                defender: { name: 'Rotom-Heat', ability: 'Levitate' },
                move: { name: 'Earthquake' }
            });
            expect(result.maxDamage).toBe(0);
            expect(result.minDamage).toBe(0);
        });

        //stat boosts and drops
        //more tests ?

        it('returns more damage when the attacker has a stat boost', () => {
            const resultWithoutBoost = calcService.calculate({
                attacker: { name: 'Sceptile-Mega' },
                defender: { name: 'Basculegion' },
                move: { name: 'Grass Knot' }
            });

            const resultWithBoost = calcService.calculate({
                attacker: { name: 'Sceptile-Mega', boosts: { spa:1 } },
                defender: { name: 'Basculegion' },
                move: { name: 'Grass Knot' }
            });

            expect(resultWithBoost.maxDamage).toBeGreaterThan(resultWithoutBoost.maxDamage);
            expect(resultWithBoost.minDamage).toBeGreaterThan(resultWithoutBoost.minDamage);
        });

        it('returns less damage when the attacker has a stat drop', () => {
            const resultWithoutDrop = calcService.calculate({
                attacker: {name:'Sneasler'},
                defender:{ name:'Incineroar'},
                move: { name: 'Close Combat' }
            });

            const resultWithDrop = calcService.calculate({
                attacker: {name:'Sneasler', boosts: { atk: -1 }},
                defender:{ name:'Incineroar'},
                move: { name: 'Close Combat' }
            });

            expect(resultWithDrop.maxDamage).toBeLessThan(resultWithoutDrop.maxDamage);
            expect(resultWithDrop.minDamage).toBeLessThan(resultWithoutDrop.minDamage);
        });

        //terrain
        //as irrelevant as it may be this reg
        //TODO

        //Crits
        //TODO

    });
});