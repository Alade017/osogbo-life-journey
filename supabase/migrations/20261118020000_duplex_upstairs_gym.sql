-- Match the duplex's guest bedroom plus two upstairs bedrooms; preserve rents and saved items.
update public.house_types set bedrooms = 3 where id = 'duplex';
