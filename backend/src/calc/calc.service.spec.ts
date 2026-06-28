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
                attacker: { name: 'Garchomp' },
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
                defender: { name: 'Sinistcha', item: 'Passho Berry' },
                move: { name: 'Last Respects' }
            });
            const resultWithMatchedBerry = calcService.calculate({
                attacker: { name: 'Basculegion' },
                defender: { name: 'Sinistcha', item: 'Kasib Berry' },
                move: { name: 'Last Respects' }
            });
            expect(resultWithMatchedBerry.maxDamage).toBeLessThan(resultWithMismatchedBerry.maxDamage);
        });
    });
});