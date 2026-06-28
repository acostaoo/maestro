import { FormatService } from './format.service';

const formatService = new FormatService();

describe('FormatService', () => {
    describe('Legal species', () => {
        it('should return true for a legal species', () => {
            expect(formatService.isLegal('Garchomp')).toBe(true);
        });

        it('should return false for a banned species', () => {

            expect(formatService.isLegal('Mewtwo')).toBe(false);
        });

        it('should return true for a species regional form', () => {
            expect(formatService.isLegal('Slowking-Galar')).toBe(true);
        });

        it('should return true for another species with a regional form', () => {
            expect(formatService.isLegal('Persian-Alola')).toBe(true);
        });

        it('should return true for a species with a regional form', () => {
            expect(formatService.isLegal('Thyplosion')).toBe(true);
        });

        //do i need more tests ?
    });
});
