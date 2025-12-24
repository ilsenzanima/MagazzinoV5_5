-- Add image_url column to item_types
ALTER TABLE public.item_types ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Insert or Update types with images
INSERT INTO public.item_types (name, image_url) VALUES 
('Aspiratori', '/categories/Aspiratori.png'),
('Attrezzatura', '/categories/Attrezzatura.png'),
('Botola', '/categories/Botola.png'),
('Box', '/categories/Box.png'),
('Brick', '/categories/Brick.png'),
('Collari', '/categories/Collari.png'),
('Coppella', '/categories/Coppella.png'),
('Ferramenta', '/categories/Ferramenta.png'),
('Guide e Montanti', '/categories/Guide_e_Montanti.png'),
('Lana', '/categories/Lana.png'),
('Lastre', '/categories/Lastre.png'),
('Nastri', '/categories/Nastri.png'),
('Pannelli', '/categories/Pannelli.png'),
('Pitture', '/categories/Pitture.png'),
('Porte', '/categories/Porte.png'),
('Profilati', '/categories/Profilati.png'),
('Sacchetti', '/categories/Sacchetti.png'),
('Silicone', '/categories/Silicone.png'),
('Stucco e Colle', '/categories/Stucco_e_Colle.png'),
('Tasselli', '/categories/Tasselli.png'),
('Viti', '/categories/Viti.png')
ON CONFLICT (name) DO UPDATE SET image_url = EXCLUDED.image_url;
