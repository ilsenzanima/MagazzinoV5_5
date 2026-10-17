import { composeVariant, VariantTemplate } from '../variant-template';

// Scheda dell'Attrezzatura: il testo composto dai valori salvati deve coincidere con la variante già presente
const attrezzatura = {
    "version": 2,
    "fields": [],
    "pattern": "",
    "subtypeLabel": "Tipo di articolo",
    "subtypes": [
        {
            "key": "punte",
            "label": "Punta o sega",
            "pattern": "ø {diametro} [L {lunghezza} mm] {altro}",
            "fields": [
                {
                    "key": "diametro",
                    "label": "Diametro",
                    "kind": "number",
                    "unit": "mm",
                    "required": true
                },
                {
                    "key": "lunghezza",
                    "label": "Lunghezza",
                    "kind": "number",
                    "unit": "mm"
                },
                {
                    "key": "altro",
                    "label": "Altro",
                    "kind": "text"
                }
            ]
        },
        {
            "key": "inserti",
            "label": "Inserto o bit",
            "pattern": "{testa} {misura} [innesto {innesto}] {altro}",
            "fields": [
                {
                    "key": "testa",
                    "label": "Testa",
                    "kind": "choice",
                    "open": true,
                    "options": [
                        "croce",
                        "torx",
                        "esagonale",
                        "taglio"
                    ],
                    "required": true
                },
                {
                    "key": "misura",
                    "label": "Misura",
                    "kind": "text",
                    "hint": "Es. PZ 3, RW 20, C 6,3"
                },
                {
                    "key": "innesto",
                    "label": "Innesto",
                    "kind": "choice",
                    "open": true,
                    "options": [
                        "1/4",
                        "3/8",
                        "1/2"
                    ]
                },
                {
                    "key": "altro",
                    "label": "Altro",
                    "kind": "text"
                }
            ]
        },
        {
            "key": "pennelli",
            "label": "Pennello, rullo o manico",
            "pattern": "[n. {numero}] [{larghezza} mm] {altro}",
            "fields": [
                {
                    "key": "numero",
                    "label": "Numero",
                    "kind": "text"
                },
                {
                    "key": "larghezza",
                    "label": "Larghezza",
                    "kind": "number",
                    "unit": "mm"
                },
                {
                    "key": "altro",
                    "label": "Altro",
                    "kind": "text"
                }
            ]
        },
        {
            "key": "altro",
            "label": "Altro",
            "pattern": "{descrizione}",
            "fields": [
                {
                    "key": "descrizione",
                    "label": "Descrizione",
                    "kind": "text",
                    "required": true
                }
            ]
        }
    ]
} as unknown as VariantTemplate;

const articoli: [string, string, Record<string, string>][] = [
    [
        "ART-00095",
        "ø 10",
        {
            "_sottotipo": "punte",
            "diametro": "10"
        }
    ],
    [
        "ART-00182",
        "ø 10",
        {
            "_sottotipo": "punte",
            "diametro": "10"
        }
    ],
    [
        "ART-00177",
        "ø 3,5",
        {
            "_sottotipo": "punte",
            "diametro": "3,5"
        }
    ],
    [
        "ART-00181",
        "ø 4",
        {
            "_sottotipo": "punte",
            "diametro": "4"
        }
    ],
    [
        "ART-00092",
        "ø 15",
        {
            "_sottotipo": "punte",
            "diametro": "15"
        }
    ],
    [
        "ATT-NUL-421",
        "ø 8",
        {
            "_sottotipo": "punte",
            "diametro": "8"
        }
    ],
    [
        "ART-00087",
        "ø 20",
        {
            "_sottotipo": "punte",
            "diametro": "20"
        }
    ],
    [
        "ATT-WUR-410",
        "ø 6",
        {
            "_sottotipo": "punte",
            "diametro": "6"
        }
    ],
    [
        "ART-00074",
        "ø 121",
        {
            "_sottotipo": "punte",
            "diametro": "121"
        }
    ],
    [
        "ART-00075",
        "ø 152",
        {
            "_sottotipo": "punte",
            "diametro": "152"
        }
    ],
    [
        "ATT-WUR-480",
        "croce PZ",
        {
            "_sottotipo": "inserti",
            "testa": "croce",
            "misura": "PZ"
        }
    ],
    [
        "ART-00106",
        "croce PZ C 6,3 (PZ 3)",
        {
            "_sottotipo": "inserti",
            "testa": "croce",
            "misura": "PZ C 6,3 (PZ 3)"
        }
    ],
    [
        "ART-00222",
        "torx RW 20",
        {
            "_sottotipo": "inserti",
            "testa": "torx",
            "misura": "RW 20"
        }
    ],
    [
        "ART-00121",
        "torx RW C 6,3",
        {
            "_sottotipo": "inserti",
            "testa": "torx",
            "misura": "RW C 6,3"
        }
    ],
    [
        "ART-00023",
        "n. 4",
        {
            "_sottotipo": "pennelli",
            "numero": "4"
        }
    ],
    [
        "ART-00192",
        "n. 5",
        {
            "_sottotipo": "pennelli",
            "numero": "5"
        }
    ],
    [
        "ART-00022",
        "n. 6",
        {
            "_sottotipo": "pennelli",
            "numero": "6"
        }
    ],
    [
        "ART-00068",
        "58 mm",
        {
            "_sottotipo": "pennelli",
            "larghezza": "58"
        }
    ],
    [
        "VAR-NUL-290",
        "100 mm ricambio",
        {
            "_sottotipo": "pennelli",
            "larghezza": "100",
            "altro": "ricambio"
        }
    ],
    [
        "ART-00039",
        "per diametro 16 mm",
        {
            "_sottotipo": "pennelli",
            "altro": "per diametro 16 mm"
        }
    ],
    [
        "ART-00067",
        "per diametro 25-27 mm",
        {
            "_sottotipo": "pennelli",
            "altro": "per diametro 25-27 mm"
        }
    ],
    [
        "VAR-NUL-298",
        "attacco per bastone",
        {
            "_sottotipo": "pennelli",
            "altro": "attacco per bastone"
        }
    ],
    [
        "ATT-NUL-403",
        "1/4 PA2",
        {
            "_sottotipo": "altro",
            "descrizione": "1/4 PA2"
        }
    ],
    [
        "ATT-WUR-476",
        "150 mm",
        {
            "_sottotipo": "altro",
            "descrizione": "150 mm"
        }
    ],
    [
        "ART-00145",
        "da spina a presa CEE",
        {
            "_sottotipo": "altro",
            "descrizione": "da spina a presa CEE"
        }
    ],
    [
        "ART-00101",
        "cercafase",
        {
            "_sottotipo": "altro",
            "descrizione": "cercafase"
        }
    ],
    [
        "ART-00161",
        "set 6 pz",
        {
            "_sottotipo": "altro",
            "descrizione": "set 6 pz"
        }
    ],
    [
        "ART-00144",
        "6 m",
        {
            "_sottotipo": "altro",
            "descrizione": "6 m"
        }
    ],
    [
        "ART-00034",
        "sottile",
        {
            "_sottotipo": "altro",
            "descrizione": "sottile"
        }
    ],
    [
        "ART-00115",
        "280x120",
        {
            "_sottotipo": "altro",
            "descrizione": "280x120"
        }
    ],
    [
        "VAR-NUL-289",
        "S/78 40",
        {
            "_sottotipo": "altro",
            "descrizione": "S/78 40"
        }
    ],
    [
        "ART-00033",
        "nitrile",
        {
            "_sottotipo": "altro",
            "descrizione": "nitrile"
        }
    ],
    [
        "ART-00026",
        "25 mm",
        {
            "_sottotipo": "altro",
            "descrizione": "25 mm"
        }
    ],
    [
        "ATT-NUL-439",
        "400 mm",
        {
            "_sottotipo": "altro",
            "descrizione": "400 mm"
        }
    ],
    [
        "ART-00118",
        "WD-40",
        {
            "_sottotipo": "altro",
            "descrizione": "WD-40"
        }
    ],
    [
        "ART-00100",
        "FFP1 con valvola",
        {
            "_sottotipo": "altro",
            "descrizione": "FFP1 con valvola"
        }
    ],
    [
        "ART-00197",
        "FFP3 carbon",
        {
            "_sottotipo": "altro",
            "descrizione": "FFP3 carbon"
        }
    ],
    [
        "ATT-WUR-428",
        "confezione da 6",
        {
            "_sottotipo": "altro",
            "descrizione": "confezione da 6"
        }
    ],
    [
        "ART-00038",
        "nero",
        {
            "_sottotipo": "altro",
            "descrizione": "nero"
        }
    ],
    [
        "ART-00160",
        "manuale",
        {
            "_sottotipo": "altro",
            "descrizione": "manuale"
        }
    ],
    [
        "ATT-NUL-438",
        "125 mm",
        {
            "_sottotipo": "altro",
            "descrizione": "125 mm"
        }
    ],
    [
        "VAR-NUL-293",
        "per lana di roccia",
        {
            "_sottotipo": "altro",
            "descrizione": "per lana di roccia"
        }
    ],
    [
        "ART-00158",
        "a tazza",
        {
            "_sottotipo": "altro",
            "descrizione": "a tazza"
        }
    ],
    [
        "ART-00157",
        "circolare",
        {
            "_sottotipo": "altro",
            "descrizione": "circolare"
        }
    ],
    [
        "ART-00056",
        "fili in ottone",
        {
            "_sottotipo": "altro",
            "descrizione": "fili in ottone"
        }
    ],
    [
        "ATT-NUL-418",
        "grana 120",
        {
            "_sottotipo": "altro",
            "descrizione": "grana 120"
        }
    ]
];

describe('scheda Attrezzatura', () => {
    it.each(articoli)('%s compone "%s"', (_code, expected, attrs) => {
        expect(composeVariant(attrezzatura, attrs)).toBe(expected);
    });
});
