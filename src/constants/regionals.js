// src/constants/regionals.js
export const REGIONALS = [
    { id: 'CRE-01', name: 'Plano Piloto', code: 'CRE-01' },
    { id: 'CRE-02', name: 'Gama', code: 'CRE-02' },
    { id: 'CRE-03', name: 'Taguatinga', code: 'CRE-03' },
    { id: 'CRE-04', name: 'Planaltina', code: 'CRE-04' },
    { id: 'CRE-05', name: 'Sobradinho', code: 'CRE-05' },
    { id: 'CRE-06', name: 'Ceilândia', code: 'CRE-06' },
    { id: 'CRE-07', name: 'Samambaia', code: 'CRE-07' },
    { id: 'CRE-08', name: 'Paranoá', code: 'CRE-08' },
    { id: 'CRE-09', name: 'São Sebastião', code: 'CRE-09' },
    { id: 'REmas', name: 'Recanto das Emas', code: 'REmas' },
    { id: 'CRE-11', name: 'Guará', code: 'CRE-11' },
    { id: 'CRE-13', name: 'Santa Maria', code: 'CRE-13' },
    { id: 'CRE-14', name: 'Núcleo Bandeirante', code: 'CRE-14' },
    // Adicione mais conforme necessário
]

// Helper para validar se uma CRE é válida
export const isValidRegional = (creCode) => {
    return REGIONALS.some(r => r.code === creCode)
}

// Helper para obter o nome da CRE
export const getRegionalName = (creCode) => {
    const regional = REGIONALS.find(r => r.code === creCode)
    return regional ? regional.name : creCode
}