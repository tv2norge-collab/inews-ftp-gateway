module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testPathIgnorePatterns: ['dist'],
	testMatch: ['**/*.(spec|test).(ts|js)'],
	transform: {
		'^.+\\.(ts|js)$': 'ts-jest',
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
}
