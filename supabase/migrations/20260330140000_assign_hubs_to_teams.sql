-- Migration: Assign hubs to teams (source: Hubs_equipos V1.xlsx)
-- Excel is the source of truth for team hub assignments
-- 16 new hubs created + 271 team hub assignments
--
-- Discrepancies noted (Excel overrides participant self-assigned hubs):
-- 20 teams where participant hub differs from Excel assignment.
-- Excel was chosen as authoritative source.

BEGIN;

-- ============================================
-- Step 1: Create 16 new hubs
-- ============================================
INSERT INTO public.hubs (name) VALUES ('ALCALA');
INSERT INTO public.hubs (name) VALUES ('ALCOBENDAS');
INSERT INTO public.hubs (name) VALUES ('ALCORCON');
INSERT INTO public.hubs (name) VALUES ('AMERICAN TOWER');
INSERT INTO public.hubs (name) VALUES ('ARAGON');
INSERT INTO public.hubs (name) VALUES ('BAJA');
INSERT INTO public.hubs (name) VALUES ('BRAINS');
INSERT INTO public.hubs (name) VALUES ('BRUNETE');
INSERT INTO public.hubs (name) VALUES ('GALICIA');
INSERT INTO public.hubs (name) VALUES ('IIE');
INSERT INTO public.hubs (name) VALUES ('KYNDRIL');
INSERT INTO public.hubs (name) VALUES ('LA NAVE');
INSERT INTO public.hubs (name) VALUES ('LAS ROZAS');
INSERT INTO public.hubs (name) VALUES ('MAJADAHONDA');
INSERT INTO public.hubs (name) VALUES ('MICROSOFT');
INSERT INTO public.hubs (name) VALUES ('UPM');

-- ============================================
-- Step 2: Assign hubs to 271 teams
-- ============================================

-- AECOM: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'AECOM' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51191', '51293', '51494');

-- ALCALA: 10 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'ALCALA' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49331', '51197', '50544', '50465', '51045', '49330', '50686', '51043', '51046', '51047');

-- ALCOBENDAS: 11 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'ALCOBENDAS' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51089', '51970', '50825', '50746', '50483', '52517', '51884', '51061', '50772', '48965', '49575');

-- ALCORCON: 7 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'ALCORCON' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49595', '49557', '49555', '49596', '49676', '52126', '49838');

-- AMERICAN TOWER: 1 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'AMERICAN TOWER' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49906');

-- ARAGON: 14 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'ARAGON' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51476', '51369', '51113', '51350', '52303', '51264', '50986', '50827', '50944', '49115', '52048', '51169', '51865', '50859');

-- Aldeafuente: 24 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Aldeafuente' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50304', '50340', '50426', '50439', '51719', '50428', '49957', '51298', '49950', '49958', '50432', '51376', '50802', '50427', '49951', '51310', '51384', '49949', '49956', '50431', '49959', '50651', '51512', '51312');

-- BAJA: 7 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'BAJA' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49277', '50961', '50117', '50853', '52201', '51615', '51367');

-- BBVA: 9 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'BBVA' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50213', '51620', '51486', '52196', '52380', '52761', '51708', '50687', '52209');

-- BRAINS: 2 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'BRAINS' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49198', '49928');

-- BRUNETE: 5 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'BRUNETE' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50919', '50767', '49384', '49945', '51830');

-- Babel: 4 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Babel' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49650', '49675', '49619', '51062');

-- Dell: 2 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Dell' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49740', '50060');

-- GALICIA: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'GALICIA' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50816', '51319', '51320');

-- IIE: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'IIE' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50204', '50208', '50323');

-- Ikea: 1 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Ikea' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51141');

-- Inditex: 23 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Inditex' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50842', '50118', '50849', '50116', '50547', '51125', '50868', '50046', '50025', '50168', '51140', '50016', '51033', '51195', '50640', '50850', '51605', '51035', '50971', '50212', '50848', '51179', '48573');

-- KYNDRIL: 2 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'KYNDRIL' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('52265', '50067');

-- LA NAVE: 2 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'LA NAVE' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51056', '51776');

-- LAS ROZAS: 9 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'LAS ROZAS' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50183', '51867', '50528', '50124', '48988', '49907', '48715', '49815', '48642');

-- Logos: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Logos' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49351', '49954', '49955');

-- MAJADAHONDA: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'MAJADAHONDA' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51108', '52122', '51130');

-- MICROSOFT: 1 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'MICROSOFT' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50369');

-- Mas Orange: 1 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Mas Orange' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51846');

-- Moeve: 6 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Moeve' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('52178', '50964', '51301', '51365', '51137', '51031');

-- NTT Datta: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'NTT Datta' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50114', '50256', '49153');

-- P2C: 15 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'P2C' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('53898', '51000', '52498', '52608', '52191', '52680', '53983', '52298', '51144', '50887', '51143', '49138', '48522', '48558', '50834');

-- Repsol: 4 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Repsol' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49698', '49200', '50026', '49276');

-- Santander: 46 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Santander' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('54575', '50865', '50125', '53899', '51576', '50368', '50039', '49853', '50292', '51124', '49801', '50279', '51289', '50931', '50398', '51729', '52259', '50412', '50411', '50253', '49967', '51266', '51142', '50272', '50704', '50817', '50271', '50305', '50324', '50319', '50004', '50653', '51607', '50416', '51826', '52514', '51477', '52662', '50638', '49946', '50278', '50011', '50527', '50866', '50770', '50481');

-- Securitas: 11 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Securitas' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50718', '50502', '50492', '50835', '50308', '50336', '50044', '50337', '50311', '50056', '50042');

-- Siemens: 9 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Siemens' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50131', '50430', '48216', '50404', '49001', '50075', '50445', '50335', '50254');

-- UC3M: 16 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'UC3M' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('50998', '52446', '52726', '50862', '53104', '51378', '51952', '50458', '53772', '52781', '50936', '49255', '50996', '52966', '51208', '50683');

-- UPM: 3 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'UPM' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('51922', '52772', '51920');

-- Usera: 1 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Usera' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('52763');

-- Verisure: 7 equipo(s)
UPDATE public.teams
SET hub_id = (SELECT id FROM public.hubs WHERE name = 'Verisure' LIMIT 1),
    updated_at = NOW()
WHERE tg_team_id IN ('49799', '50596', '49962', '49825', '49917', '50549', '50338');

COMMIT;
